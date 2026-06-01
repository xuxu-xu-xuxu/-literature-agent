from fastapi import APIRouter, Depends
from sqlalchemy import select
from backend.models.database import get_db, Entity, EntitySchema, EntitySynonym
from backend.models.schemas import EntityQueryParams
from backend.services.entity_mining import mine_entities
from backend.services.schema_convergence import run_schema_convergence

router = APIRouter(prefix="/api", tags=["entities"])


@router.get("/entities")
async def query_entities(params: EntityQueryParams = Depends()):
    async for db in get_db():
        query = select(Entity)
        if params.entity_type:
            query = query.where(Entity.entity_type == params.entity_type)
        if params.paper_id:
            query = query.where(Entity.paper_id == params.paper_id)
        if params.attribute_key and params.attribute_value:
            query = query.where(Entity.attributes[params.attribute_key].as_string() == params.attribute_value)
        query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)

        result = await db.execute(query)
        entities = result.scalars().all()
        break

    return {
        "items": [
            {
                "id": e.id,
                "paper_id": e.paper_id,
                "entity_type": e.entity_type,
                "attributes": e.attributes,
                "source_span": e.source_span,
            }
            for e in entities
        ],
        "page": params.page,
        "page_size": params.page_size,
    }

@router.get("/entities/types")
async def list_entity_types():
    async for db in get_db():
        result = await db.execute(select(Entity.entity_type).distinct())
        types = [row[0] for row in result.fetchall()]
        break
    return {"types": types}

@router.get("/entities/synonyms")
async def list_synonyms():
    async for db in get_db():
        result = await db.execute(select(EntitySynonym))
        synonyms = [{"canonical": s.canonical, "variant": s.variant} for s in result.scalars().all()]
        break
    return {"synonyms": synonyms}

@router.post("/entities/converge")
async def trigger_convergence():
    result = await run_schema_convergence()
    return result


@router.post("/entities/mine")
async def trigger_entity_mining(
    domain_id: str | None = None,
    replace: bool = True,
    paper_limit: int | None = None,
    chunk_limit: int = 10000,
):
    return await mine_entities(
        domain_id=domain_id,
        replace=replace,
        paper_limit=paper_limit,
        chunk_limit=chunk_limit,
    )
