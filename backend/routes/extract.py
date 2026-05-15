from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import select, func
from backend.models.database import get_db, Paper, Entity
from backend.services.extract_service import run_extraction

router = APIRouter(prefix="/api", tags=["extract"])


@router.post("/extract/{paper_id}")
async def trigger_extraction(paper_id: str, background_tasks: BackgroundTasks):
    async for db in get_db():
        paper = await db.get(Paper, paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        if not paper.full_text:
            raise HTTPException(status_code=400, detail="Paper has no text content")
        break

    background_tasks.add_task(run_extraction, paper_id, paper.full_text)
    return {"paper_id": paper_id, "status": "extraction_started"}


@router.get("/extract/{paper_id}/status")
async def extraction_status(paper_id: str):
    async for db in get_db():
        paper = await db.get(Paper, paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        count_result = await db.execute(
            select(func.count()).select_from(Entity).where(Entity.paper_id == paper_id)
        )
        count = count_result.scalar()
        break
    return {"paper_id": paper_id, "status": "done" if count > 0 else "pending", "entity_count": count}
