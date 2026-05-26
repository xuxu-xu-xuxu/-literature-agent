import os
import uuid
import zipfile

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Form, HTTPException
from sqlalchemy import select
from backend.models.database import get_db, IngestionJob, Paper, PaperProcessingTask
from backend.services.pdf_service import save_upload, compute_paper_id
from backend.services.ingestion import ingest_pdf
from backend.config import get_settings

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    auto_mine: bool = Form(default=False),
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

    background_tasks.add_task(_process_paper, paper_id, file_path, auto_mine)
    return {"paper_id": paper_id, "status": "processing"}


@router.post("/upload/batch")
async def upload_batch(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    auto_mine: bool = Form(default=False),
):
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Batch upload expects a .zip file of PDFs")
    settings = get_settings()
    job_id = uuid.uuid4().hex
    job_dir = os.path.join(settings.upload_dir, "jobs", job_id)
    os.makedirs(job_dir, exist_ok=True)
    zip_path = save_upload(await file.read(), file.filename, job_dir)
    pdf_paths = []
    try:
        with zipfile.ZipFile(zip_path) as archive:
            for item in archive.infolist():
                if item.is_dir() or not item.filename.lower().endswith(".pdf"):
                    continue
                original_name = os.path.basename(item.filename) or "paper.pdf"
                target = os.path.join(job_dir, f"{uuid.uuid4().hex}_{original_name}")
                with archive.open(item) as source, open(target, "wb") as dest:
                    dest.write(source.read())
                pdf_paths.append(target)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Invalid zip file") from exc

    async for db in get_db():
        db.add(IngestionJob(id=job_id, status="queued", total=len(pdf_paths)))
        for path in pdf_paths:
            db.add(PaperProcessingTask(job_id=job_id, filename=os.path.basename(path), status="queued"))
        await db.commit()
        break

    background_tasks.add_task(_process_batch, job_id, pdf_paths, auto_mine)
    return {"job_id": job_id, "status": "queued", "total": len(pdf_paths)}


@router.get("/ingestion/jobs")
async def list_ingestion_jobs():
    async for db in get_db():
        result = await db.execute(select(IngestionJob).order_by(IngestionJob.created_at.desc()).limit(50))
        jobs = result.scalars().all()
        break
    return {"items": [_job_to_dict(job) for job in jobs]}


@router.get("/ingestion/jobs/{job_id}")
async def get_ingestion_job(job_id: str):
    async for db in get_db():
        job = await db.get(IngestionJob, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        tasks_result = await db.execute(select(PaperProcessingTask).where(PaperProcessingTask.job_id == job_id))
        tasks = tasks_result.scalars().all()
        break
    data = _job_to_dict(job)
    data["tasks"] = [
        {
            "id": task.id,
            "paper_id": task.paper_id,
            "filename": task.filename,
            "status": task.status,
            "stage": task.stage,
            "error": task.error,
        }
        for task in tasks
    ]
    return data


async def _process_paper(paper_id: str, file_path: str, auto_mine: bool = False):
    from backend.services.extract_service import run_extraction
    from backend.services.solid_electrolyte import extract_solid_electrolyte_records

    result = await ingest_pdf(file_path)
    async for db in get_db():
        paper = await db.get(Paper, paper_id)
        if paper:
            doc_title = (result.get("title") or "").strip()
            if doc_title and len(doc_title) > len(paper.title):
                paper.title = doc_title
            paper.full_text = result["full_text"]
            paper.status = "ingested"
            await db.commit()
        break

    if auto_mine and result.get("full_text"):
        await extract_solid_electrolyte_records(paper_id, result["full_text"])

    # keep the legacy dynamic extractor behind the explicit auto_mine switch
    if auto_mine and result.get("full_text"):
        try:
            await run_extraction(paper_id, result["full_text"])
        except Exception:
            pass
    # keep PDF file on disk for reference


async def _process_batch(job_id: str, pdf_paths: list[str], auto_mine: bool):
    async for db in get_db():
        job = await db.get(IngestionJob, job_id)
        if job:
            job.status = "running"
            await db.commit()
        break

    for path in pdf_paths:
        filename = os.path.basename(path)
        async for db in get_db():
            job = await db.get(IngestionJob, job_id)
            task_result = await db.execute(
                select(PaperProcessingTask)
                .where(PaperProcessingTask.job_id == job_id)
                .where(PaperProcessingTask.filename == filename)
                .limit(1)
            )
            task = task_result.scalar_one_or_none()
            if job:
                job.current_file = filename
            if task:
                task.status = "running"
                task.stage = "hashing"
            await db.commit()
            break

        try:
            paper_id = compute_paper_id(path)
            duplicate = False
            async for db in get_db():
                existing = await db.get(Paper, paper_id)
                task = (await db.execute(
                    select(PaperProcessingTask)
                    .where(PaperProcessingTask.job_id == job_id)
                    .where(PaperProcessingTask.filename == filename)
                    .limit(1)
                )).scalar_one_or_none()
                if existing:
                    duplicate = True
                else:
                    db.add(Paper(id=paper_id, title=filename, file_path=path, status="processing"))
                if task:
                    task.paper_id = paper_id
                    task.stage = "ingesting"
                await db.commit()
                break

            if duplicate:
                async for db in get_db():
                    job = await db.get(IngestionJob, job_id)
                    task = (await db.execute(
                        select(PaperProcessingTask)
                        .where(PaperProcessingTask.job_id == job_id)
                        .where(PaperProcessingTask.filename == filename)
                        .limit(1)
                    )).scalar_one_or_none()
                    if job:
                        job.duplicate += 1
                    if task:
                        task.status = "duplicate"
                    await db.commit()
                    break
                continue

            await _process_paper(paper_id, path, auto_mine)
            async for db in get_db():
                job = await db.get(IngestionJob, job_id)
                task = (await db.execute(
                    select(PaperProcessingTask)
                    .where(PaperProcessingTask.job_id == job_id)
                    .where(PaperProcessingTask.filename == filename)
                    .limit(1)
                )).scalar_one_or_none()
                if job:
                    job.succeeded += 1
                if task:
                    task.status = "done"
                    task.stage = "done"
                await db.commit()
                break
        except Exception as exc:
            async for db in get_db():
                job = await db.get(IngestionJob, job_id)
                task = (await db.execute(
                    select(PaperProcessingTask)
                    .where(PaperProcessingTask.job_id == job_id)
                    .where(PaperProcessingTask.filename == filename)
                    .limit(1)
                )).scalar_one_or_none()
                if job:
                    job.failed += 1
                    job.error = str(exc)
                if task:
                    task.status = "failed"
                    task.error = str(exc)
                await db.commit()
                break

    async for db in get_db():
        job = await db.get(IngestionJob, job_id)
        if job:
            job.status = "done" if job.failed == 0 else "partial_failed"
            job.current_file = None
            await db.commit()
        break


def _job_to_dict(job: IngestionJob) -> dict:
    return {
        "id": job.id,
        "status": job.status,
        "total": job.total,
        "succeeded": job.succeeded,
        "failed": job.failed,
        "duplicate": job.duplicate,
        "current_file": job.current_file,
        "error": job.error,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }
