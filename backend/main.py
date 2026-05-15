from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.upload import router as upload_router
from backend.routes.papers import router as papers_router
from backend.routes.chat import router as chat_router
from backend.routes.extract import router as extract_router
from backend.routes.visualize import router as visualize_router
from backend.routes.entities import router as entities_router
from backend.models.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception:
        pass
    yield


app = FastAPI(title="Literature Agent API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(papers_router)
app.include_router(chat_router)
app.include_router(extract_router)
app.include_router(visualize_router)
app.include_router(entities_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
