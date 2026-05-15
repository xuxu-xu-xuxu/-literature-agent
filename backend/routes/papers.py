from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.models.database import get_db, Paper
from backend.models.schemas import PaperOut, PaperDetailOut, PaperListParams

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
        await db.delete(paper)
        await db.commit()
        break
    return {"deleted": paper_id}
