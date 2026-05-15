from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from backend.models.database import get_db, Paper
from backend.services.pdf_service import save_upload, compute_paper_id
from backend.services.ingestion import ingest_pdf
from backend.config import get_settings
import os

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    settings = get_settings()
    content = await file.read()
    file_path = save_upload(content, file.filename, settings.upload_dir)
    paper_id = compute_paper_id(file_path)

    async for db in get_db():
        existing = await db.get(Paper, paper_id)
        if existing:
            return {"paper_id": paper_id, "status": "duplicate", "message": "Paper already exists"}
        db.add(Paper(id=paper_id, title=file.filename, file_path=file_path, status="processing"))
        await db.commit()
        break

    background_tasks.add_task(_process_paper, paper_id, file_path)
    return {"paper_id": paper_id, "status": "processing"}


async def _process_paper(paper_id: str, file_path: str):
    result = await ingest_pdf(file_path)
    async for db in get_db():
        paper = await db.get(Paper, paper_id)
        if paper:
            paper.title = result["title"]
            paper.full_text = result["full_text"]
            paper.status = "ingested"
            await db.commit()
        break
    if os.path.exists(file_path):
        os.remove(file_path)
