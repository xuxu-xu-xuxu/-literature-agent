import os
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from backend.models.database import get_db, Paper, Entity, EntitySchema, EntitySynonym, SolidElectrolyteRecord
from backend.models.schemas import PaperOut, PaperDetailOut, PaperListParams
from backend.services.ingestion import init_milvus, init_es

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["papers"])


@router.get("/papers")
async def list_papers(params: PaperListParams = Depends()):
    async for db in get_db():
        query = select(Paper)
        if params.keyword:
            query = query.where(Paper.title.ilike(f"%{params.keyword}%"))
        if params.year_from is not None:
            query = query.where(Paper.year >= params.year_from)
        if params.year_to is not None:
            query = query.where(Paper.year <= params.year_to)
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)

        result = await db.execute(query)
        papers = result.scalars().all()

        count_result = await db.execute(select(func.count()).select_from(Paper))
        total = count_result.scalar()
        break

    return {
        "items": [PaperOut.model_validate(p) for p in papers],
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
    }


@router.get("/papers/{paper_id}")
async def get_paper(paper_id: str):
    async for db in get_db():
        paper = await db.get(Paper, paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        return PaperDetailOut.model_validate(paper)


@router.delete("/papers/{paper_id}")
async def delete_paper(paper_id: str):
    async for db in get_db():
        paper = await db.get(Paper, paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        file_path = paper.file_path

        # Delete related entities and schemas first (FK constraint)
        schemas = (await db.execute(
            select(EntitySchema).where(EntitySchema.paper_id == paper_id)
        )).scalars().all()
        for es in schemas:
            await db.delete(es)

        entities = (await db.execute(
            select(Entity).where(Entity.paper_id == paper_id)
        )).scalars().all()
        for entity in entities:
            await db.delete(entity)

        records = (await db.execute(
            select(SolidElectrolyteRecord).where(SolidElectrolyteRecord.paper_id == paper_id)
        )).scalars().all()
        for record in records:
            await db.delete(record)

        await db.delete(paper)

        # Clean up orphaned synonyms — delete synonyms whose canonical
        # or variant no longer appears in the remaining entity types
        remaining_types = (await db.execute(select(Entity.entity_type).distinct())).scalars().all()
        remaining_types_set = set(remaining_types)
        if remaining_types_set:
            all_synonyms = (await db.execute(select(EntitySynonym))).scalars().all()
            for syn in all_synonyms:
                if syn.canonical not in remaining_types_set or syn.variant not in remaining_types_set:
                    await db.delete(syn)
        else:
            synonyms_to_delete = (await db.execute(select(EntitySynonym))).scalars().all()
            for syn in synonyms_to_delete:
                await db.delete(syn)

        await db.commit()
        break

    # Clean up Milvus, Elasticsearch, and file — best-effort, don't fail the request
    try:
        init_milvus().delete(expr=f'paper_id == "{paper_id}"')
    except Exception as e:
        logger.warning("Milvus delete failed for %s: %s", paper_id, e)

    try:
        init_es().delete_by_query(index="papers", body={"query": {"term": {"paper_id": paper_id}}}, refresh=True)
        init_es().delete_by_query(index="paper_chunks", body={"query": {"term": {"paper_id": paper_id}}}, refresh=True)
    except Exception as e:
        logger.warning("ES delete failed for %s: %s", paper_id, e)

    if file_path:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            logger.warning("File delete failed for %s: %s", file_path, e)

    return {"deleted": paper_id}
