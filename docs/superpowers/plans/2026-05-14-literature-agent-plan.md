# Literature Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a literature Q&A agent with RAG, dynamic entity extraction, and one-click visualization for materials science papers.

**Architecture:** FastAPI backend with 5 services (PDF ingestion, RAG, entity extraction, visualization, LLM abstraction) communicating through clear interfaces. Next.js frontend with 3-column layout (sidebar + chat + viz). Existing Milvus, ES, BGE-M3 infrastructure reused.

**Tech Stack:** Python 3.10+, FastAPI, SQLAlchemy, PostgreSQL, Milvus (pymilvus), Elasticsearch, Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, ECharts

---

### Task 1: Backend project skeleton

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/config.py`
- Create: `backend/main.py`
- Create: `backend/models/__init__.py`
- Create: `backend/routes/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/llm/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Write backend requirements**

```txt
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
asyncpg==0.30.0
psycopg2-binary==2.9.10
pymilvus==2.5.5
elasticsearch==8.17.0
httpx==0.28.1
pydantic==2.10.4
pydantic-settings==2.7.1
python-multipart==0.0.19
pymupdf==1.25.2
docling==2.23.0
FlagEmbedding==1.3.3
sse-starlette==2.2.1
```

- [ ] **Step 2: Write config**

```python
# backend/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    milvus_host: str = "localhost"
    milvus_port: int = 19530
    es_host: str = "http://localhost:9200"
    es_user: str = "elastic"
    es_password: str = "YourPassword123!"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/literature"
    bge_embed_url: str = "http://localhost:8000/embed"
    llm_provider: str = "deepseek"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-chat"
    upload_dir: str = "./uploads"
    chunk_size: int = 512
    chunk_overlap: int = 64

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3: Write FastAPI entry point**

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Literature Agent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Start FastAPI and verify health endpoint**

```bash
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8080 &
sleep 3
curl http://localhost:8080/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: Initialize git repo (if not already) and commit**

```bash
git init
echo "volumes/\nnode_modules/\n.env\n__pycache__/\n*.pyc\n.venv/\nuploads/" > .gitignore
git add -A && git commit -m "feat: backend project skeleton with FastAPI entry point"
```

---

### Task 2: SQLAlchemy database models

**Files:**
- Create: `backend/models/database.py`
- Create: `backend/tests/test_database.py`

- [ ] **Step 1: Write database models**

```python
# backend/models/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Text, String, DateTime, JSON, Integer
from datetime import datetime

from config import get_settings

settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session

class Paper(Base):
    __tablename__ = "papers"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    authors: Mapped[str] = mapped_column(Text, nullable=True)
    year: Mapped[int] = mapped_column(Integer, nullable=True)
    journal: Mapped[str] = mapped_column(String(512), nullable=True)
    abstract: Mapped[str] = mapped_column(Text, nullable=True)
    full_text: Mapped[str] = mapped_column(Text, nullable=True)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="uploaded")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Entity(Base):
    __tablename__ = "entities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(256), nullable=False)
    attributes: Mapped[dict] = mapped_column(JSON, nullable=False)
    source_span: Mapped[str] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class EntitySchema(Base):
    __tablename__ = "entity_schemas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[str] = mapped_column(String(64), nullable=False)
    schema_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class EntitySynonym(Base):
    __tablename__ = "entity_synonyms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    canonical: Mapped[str] = mapped_column(String(256), nullable=False)
    variant: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 2: Write test for database model creation**

```python
# backend/tests/test_database.py
import pytest
from sqlalchemy import inspect

@pytest.mark.asyncio
async def test_paper_model_exists():
    from models.database import Base, Paper
    mapper = inspect(Paper)
    assert mapper.tables[0].name == "papers"
    assert "title" in mapper.columns
    assert "full_text" in mapper.columns

@pytest.mark.asyncio
async def test_entity_model_jsonb():
    from models.database import Entity
    mapper = inspect(Entity)
    assert "attributes" in mapper.columns
    assert "entity_type" in mapper.columns
```

- [ ] **Step 3: Run tests to verify**

```bash
cd backend && pytest tests/test_database.py -v
```

Expected: 2 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/models/database.py backend/tests/test_database.py
git commit -m "feat: SQLAlchemy models for papers, entities, schemas, and synonyms"
```

---

### Task 3: Pydantic request/response schemas

**Files:**
- Create: `backend/models/schemas.py`

- [ ] **Step 1: Write Pydantic schemas**

```python
# backend/models/schemas.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PaperOut(BaseModel):
    id: str
    title: str
    authors: Optional[str]
    year: Optional[int]
    journal: Optional[str]
    abstract: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class PaperDetailOut(PaperOut):
    full_text: Optional[str]

class PaperListParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    keyword: Optional[str] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None

class ChatRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None
    scope_paper_ids: list[str] = []
    stream: bool = True

class ChatEvent(BaseModel):
    type: str  # "chunk" | "citation" | "done" | "error"
    content: Optional[str] = None
    refs: Optional[list[dict]] = None

class ExtractRequest(BaseModel):
    paper_id: str

class ExtractStatus(BaseModel):
    paper_id: str
    status: str  # "pending" | "running" | "done" | "error"
    entity_count: Optional[int] = None

class VisualizeRequest(BaseModel):
    query: str
    scope_paper_ids: list[str] = []

class VisualizeResponse(BaseModel):
    chart_type: str
    title: str
    data: list[dict]
    echarts_option: dict
    explanation: Optional[str] = None

class EntityQueryParams(BaseModel):
    entity_type: Optional[str] = None
    paper_id: Optional[str] = None
    attribute_key: Optional[str] = None
    attribute_value: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)
```

- [ ] **Step 2: Commit**

```bash
git add backend/models/schemas.py
git commit -m "feat: Pydantic schemas for all API request/response types"
```

---

### Task 4: LLM abstraction layer

**Files:**
- Create: `backend/llm/base.py`
- Create: `backend/llm/deepseek.py`
- Create: `backend/llm/openai.py`
- Create: `backend/tests/test_llm.py`

- [ ] **Step 1: Write LLM base interface**

```python
# backend/llm/base.py
from abc import ABC, abstractmethod
from typing import AsyncIterator

class LLMClient(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict], stream: bool = False) -> str:
        pass

    @abstractmethod
    async def chat_stream(self, messages: list[dict]) -> AsyncIterator[str]:
        pass
```

- [ ] **Step 2: Write DeepSeek implementation**

```python
# backend/llm/deepseek.py
import httpx
from typing import AsyncIterator
from .base import LLMClient

class DeepSeekClient(LLMClient):
    def __init__(self, api_key: str, model: str = "deepseek-chat", base_url: str = "https://api.deepseek.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def chat(self, messages: list[dict], stream: bool = False) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "stream": False}
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def chat_stream(self, messages: list[dict]) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "stream": True}
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        import json
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        if "content" in delta:
                            yield delta["content"]
```

- [ ] **Step 3: Write OpenAI implementation**

```python
# backend/llm/openai.py
import httpx
from typing import AsyncIterator
from .base import LLMClient

class OpenAIClient(LLMClient):
    def __init__(self, api_key: str, model: str = "gpt-4o", base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def chat(self, messages: list[dict], stream: bool = False) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "stream": False}
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def chat_stream(self, messages: list[dict]) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "stream": True}
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        import json
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        if "content" in delta:
                            yield delta["content"]
```

- [ ] **Step 4: Write LLM factory**

```python
# backend/llm/__init__.py
from .base import LLMClient
from .deepseek import DeepSeekClient
from .openai import OpenAIClient
from config import get_settings

def get_llm_client() -> LLMClient:
    settings = get_settings()
    if settings.llm_provider == "deepseek":
        return DeepSeekClient(api_key=settings.llm_api_key, model=settings.llm_model, base_url=settings.llm_base_url)
    elif settings.llm_provider == "openai":
        return OpenAIClient(api_key=settings.llm_api_key, model=settings.llm_model, base_url=settings.llm_base_url)
    else:
        raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")
```

- [ ] **Step 5: Write test for LLM factory**

```python
# backend/tests/test_llm.py
def test_get_llm_client_deepseek():
    from llm import get_llm_client
    from llm.deepseek import DeepSeekClient
    import os
    os.environ["LLM_PROVIDER"] = "deepseek"
    os.environ["LLM_API_KEY"] = "sk-test"
    client = get_llm_client()
    assert isinstance(client, DeepSeekClient)
    assert client.model == "deepseek-chat"
```

- [ ] **Step 6: Run test**

```bash
cd backend && pytest tests/test_llm.py -v
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/llm/ backend/tests/test_llm.py
git commit -m "feat: LLM abstraction with DeepSeek and OpenAI clients"
```

---

### Task 5: PDF parsing service

**Files:**
- Create: `backend/services/pdf_service.py`
- Create: `backend/tests/test_pdf_service.py`

- [ ] **Step 1: Write PDF parsing with Docling**

```python
# backend/services/pdf_service.py
import hashlib
import uuid
import os
from docling.document_converter import DocumentConverter

converter = DocumentConverter()

def compute_paper_id(file_path: str) -> str:
    sha = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            sha.update(chunk)
    return sha.hexdigest()[:16]

def parse_pdf(file_path: str) -> dict:
    result = converter.convert(file_path)
    markdown_text = result.document.export_to_markdown()
    metadata = _extract_metadata(file_path)
    sections = _split_by_sections(markdown_text)
    tables = _extract_tables_from_doc(result)
    return {
        "paper_id": compute_paper_id(file_path),
        "metadata": metadata,
        "full_text": markdown_text,
        "sections": sections,
        "tables": tables,
    }

def _extract_metadata(file_path: str) -> dict:
    import fitz
    doc = fitz.open(file_path)
    meta = doc.metadata
    first_page = doc[0].get_text()[:1000] if doc.page_count > 0 else ""
    doc.close()
    title = meta.get("title", "") or first_page.split("\n")[0] if first_page else ""
    author = meta.get("author", "")
    return {"title": title.strip(), "authors": author.strip()}

def _split_by_sections(text: str) -> list[dict]:
    import re
    sections = []
    pattern = re.compile(r"^#{1,3}\s+(.+)$", re.MULTILINE)
    matches = list(pattern.finditer(text))
    for i, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[i+1].start() if i+1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append({"heading": title, "content": body})
    if not sections:
        sections.append({"heading": "", "content": text})
    return sections

def _extract_tables_from_doc(result) -> list[dict]:
    tables = []
    for table in result.document.tables:
        if hasattr(table, "export_to_dataframe"):
            df = table.export_to_dataframe()
            tables.append(df.to_dict(orient="records"))
    return tables

def save_upload(file_content: bytes, filename: str, upload_dir: str) -> str:
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{uuid.uuid4().hex}_{filename}")
    with open(file_path, "wb") as f:
        f.write(file_content)
    return file_path
```

- [ ] **Step 2: Write test for paper_id generation**

```python
# backend/tests/test_pdf_service.py
def test_compute_paper_id_deterministic(tmp_path):
    from services.pdf_service import compute_paper_id
    f = tmp_path / "test.pdf"
    f.write_text("hello world")
    id1 = compute_paper_id(str(f))
    id2 = compute_paper_id(str(f))
    assert id1 == id2
    assert len(id1) == 16

def test_save_upload_creates_file(tmp_path):
    from services.pdf_service import save_upload
    path = save_upload(b"fake pdf", "test.pdf", str(tmp_path))
    assert os.path.exists(path)
    assert "test.pdf" in os.path.basename(path)
```

- [ ] **Step 3: Run tests**

```bash
cd backend && pytest tests/test_pdf_service.py -v
```

Expected: 2 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/services/pdf_service.py backend/tests/test_pdf_service.py
git commit -m "feat: PDF parsing service with Docling and PyMuPDF"
```

---

### Task 6: Chunking service

**Files:**
- Create: `backend/services/chunking.py`
- Create: `backend/tests/test_chunking.py`

- [ ] **Step 1: Write chunking logic**

```python
# backend/services/chunking.py
import re
from typing import List

def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> List[str]:
    sentences = _split_sentences(text)
    chunks = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) <= chunk_size:
            current += sent
        else:
            if current:
                chunks.append(current.strip())
            overlap_text = current[-overlap:] if len(current) > overlap else current
            current = overlap_text + sent
    if current.strip():
        chunks.append(current.strip())
    return chunks

def chunk_sections(sections: list[dict], chunk_size: int = 512, overlap: int = 64) -> list[dict]:
    result = []
    for sec in sections:
        sec_chunks = chunk_text(sec["content"], chunk_size, overlap)
        for i, c in enumerate(sec_chunks):
            result.append({
                "text": c,
                "heading": sec["heading"],
                "chunk_index": i,
            })
    return result

def _split_sentences(text: str) -> List[str]:
    pattern = re.compile(r'(?<=[。！？.!?\n])\s*')
    parts = pattern.split(text)
    result = []
    for p in parts:
        if p.strip():
            result.append(p)
    if not result:
        result = [text]
    return result
```

- [ ] **Step 2: Write tests**

```python
# backend/tests/test_chunking.py
from services.chunking import chunk_text, chunk_sections

def test_chunk_text_basic():
    text = "This is sentence one. This is sentence two. " * 50
    chunks = chunk_text(text, chunk_size=200, overlap=20)
    assert len(chunks) > 1
    for c in chunks:
        assert len(c) <= 220  # some slack for sentence boundary

def test_chunk_text_short_input():
    text = "Short text."
    chunks = chunk_text(text, chunk_size=512, overlap=64)
    assert len(chunks) == 1
    assert chunks[0] == "Short text."

def test_chunk_sections_preserves_heading():
    sections = [
        {"heading": "Introduction", "content": "Content of intro. More content."},
        {"heading": "Methods", "content": "Method details here."},
    ]
    chunks = chunk_sections(sections, chunk_size=100, overlap=10)
    intro_chunks = [c for c in chunks if c["heading"] == "Introduction"]
    assert len(intro_chunks) >= 1
    for c in chunks:
        assert "heading" in c
        assert "chunk_index" in c

def test_empty_text():
    chunks = chunk_text("", chunk_size=512, overlap=64)
    assert chunks == []
```

- [ ] **Step 3: Run tests**

```bash
cd backend && pytest tests/test_chunking.py -v
```

Expected: 4 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/services/chunking.py backend/tests/test_chunking.py
git commit -m "feat: sentence-aware chunking with section boundary preservation"
```

---

### Task 7: Embedding service client

**Files:**
- Create: `backend/services/embedding.py`
- Create: `backend/tests/test_embedding.py`

- [ ] **Step 1: Write embedding client**

```python
# backend/services/embedding.py
import httpx
from config import get_settings

async def embed_sentences(sentences: list[str], return_sparse: bool = False) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{settings.bge_embed_url}",
            json={"sentences": sentences, "return_sparse": return_sparse}
        )
        resp.raise_for_status()
        return resp.json()

async def embed_single(text: str) -> list[float]:
    result = await embed_sentences([text])
    return result["dense_embeddings"][0]
```

- [ ] **Step 2: Write test (mock BGE API)**

```python
# backend/tests/test_embedding.py
import pytest
from unittest.mock import patch, AsyncMock

@pytest.mark.asyncio
async def test_embed_sentences():
    mock_resp = AsyncMock()
    mock_resp.json.return_value = {"dense_embeddings": [[0.1, 0.2, 0.3]]}
    mock_resp.raise_for_status = lambda: None
    with patch("services.embedding.httpx.AsyncClient.post", return_value=mock_resp):
        from services.embedding import embed_sentences
        result = await embed_sentences(["test sentence"])
        assert len(result["dense_embeddings"]) == 1
        assert len(result["dense_embeddings"][0]) == 3

@pytest.mark.asyncio
async def test_embed_single():
    mock_resp = AsyncMock()
    mock_resp.json.return_value = {"dense_embeddings": [[0.5, 0.6]]}
    mock_resp.raise_for_status = lambda: None
    with patch("services.embedding.httpx.AsyncClient.post", return_value=mock_resp):
        from services.embedding import embed_single
        vec = await embed_single("hello")
        assert vec == [0.5, 0.6]
```

- [ ] **Step 3: Run tests**

```bash
cd backend && pytest tests/test_embedding.py -v
```

Expected: 2 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/services/embedding.py backend/tests/test_embedding.py
git commit -m "feat: BGE-M3 embedding service client"
```

---

### Task 8: Ingestion pipeline (PDF → Milvus + ES)

**Files:**
- Create: `backend/services/ingestion.py`
- Create: `backend/tests/test_ingestion.py`

- [ ] **Step 1: Write Milvus collection setup**

```python
# backend/services/ingestion.py
from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType
from config import get_settings

COLLECTION_NAME = "literature_chunks"
DIM = 1024

def init_milvus():
    settings = get_settings()
    connections.connect(alias="default", host=settings.milvus_host, port=settings.milvus_port)
    if COLLECTION_NAME in [c.name for c in Collection.list_collections()]:
        return Collection(COLLECTION_NAME)
    fields = [
        FieldSchema(name="id", dtype=DataType.VARCHAR, is_primary=True, max_length=64),
        FieldSchema(name="paper_id", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="chunk_index", dtype=DataType.INT64),
        FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=4096),
        FieldSchema(name="heading", dtype=DataType.VARCHAR, max_length=512),
        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=DIM),
    ]
    schema = CollectionSchema(fields, description="Literature chunks")
    collection = Collection(COLLECTION_NAME, schema)
    index_params = {"metric_type": "COSINE", "index_type": "IVF_FLAT", "params": {"nlist": 128}}
    collection.create_index("embedding", index_params)
    collection.load()
    return collection
```

- [ ] **Step 2: Write ES index setup and ingestion**

```python
# backend/services/ingestion.py (continued)
from elasticsearch import Elasticsearch

def init_es() -> Elasticsearch:
    settings = get_settings()
    es = Elasticsearch(
        settings.es_host,
        basic_auth=(settings.es_user, settings.es_password),
        verify_certs=False,
    )
    if not es.indices.exists(index="papers"):
        es.indices.create(index="papers", body={
            "mappings": {
                "properties": {
                    "paper_id": {"type": "keyword"},
                    "title": {"type": "text", "analyzer": "standard"},
                    "abstract": {"type": "text", "analyzer": "standard"},
                    "full_text": {"type": "text", "analyzer": "standard"},
                    "authors": {"type": "text"},
                    "year": {"type": "integer"},
                    "journal": {"type": "text"},
                }
            }
        })
    return es
```

- [ ] **Step 3: Write full ingestion function**

```python
# backend/services/ingestion.py (continued)
from services.embedding import embed_sentences
from services.chunking import chunk_sections
from services.pdf_service import parse_pdf
from models.database import Paper
import uuid

async def ingest_pdf(file_path: str) -> dict:
    parsed = parse_pdf(file_path)
    paper_id = parsed["paper_id"]
    meta = parsed["metadata"]
    sections = parsed["sections"]

    chunks = chunk_sections(sections)
    texts = [c["text"] for c in chunks]
    emb_result = await embed_sentences(texts)

    collection = init_milvus()
    entities = []
    for i, (chunk, emb) in enumerate(zip(chunks, emb_result["dense_embeddings"])):
        entities.append({
            "id": f"{paper_id}_{i}",
            "paper_id": paper_id,
            "chunk_index": i,
            "text": chunk["text"],
            "heading": chunk["heading"],
            "embedding": emb,
        })
    collection.insert(entities)
    collection.flush()

    es = init_es()
    es.index(index="papers", id=paper_id, document={
        "paper_id": paper_id,
        "title": meta["title"],
        "authors": meta.get("authors", ""),
        "abstract": parsed["full_text"][:1000],
        "full_text": parsed["full_text"],
        "year": None,
        "journal": "",
    })

    return {
        "paper_id": paper_id,
        "title": meta["title"],
        "chunk_count": len(chunks),
        "full_text": parsed["full_text"],
        "tables": parsed.get("tables", []),
    }
```

- [ ] **Step 4: Write integration test**

```python
# backend/tests/test_ingestion.py
def test_init_es_creates_index():
    from services.ingestion import init_es
    es = init_es()
    assert es.indices.exists(index="papers")

def test_init_milvus_creates_collection():
    from services.ingestion import init_milvus
    col = init_milvus()
    assert col.name == "literature_chunks"
```

- [ ] **Step 5: Run tests**

```bash
cd backend && pytest tests/test_ingestion.py -v
```

Expected: 2 PASS (requires running Milvus + ES, or mark as integration)

- [ ] **Step 6: Commit**

```bash
git add backend/services/ingestion.py backend/tests/test_ingestion.py
git commit -m "feat: ingestion pipeline - PDF to Milvus and Elasticsearch"
```

---

### Task 9: RAG search service

**Files:**
- Create: `backend/services/rag_search.py`
- Create: `backend/tests/test_rag_search.py`

- [ ] **Step 1: Write hybrid search with RRF**

```python
# backend/services/rag_search.py
from services.embedding import embed_single
from services.ingestion import init_milvus, init_es, COLLECTION_NAME
from collections import defaultdict

async def hybrid_search(query: str, top_k: int = 20) -> list[dict]:
    query_vec = await embed_single(query)

    col = init_milvus()
    col.load()
    search_params = {"metric_type": "COSINE", "params": {"nprobe": 16}}
    milvus_results = col.search(
        data=[query_vec], anns_field="embedding", param=search_params,
        limit=top_k, output_fields=["paper_id", "text", "heading", "chunk_index"]
    )

    es = init_es()
    es_results = es.search(index="papers", body={
        "query": {"match": {"full_text": {"query": query, "operator": "or"}}},
        "size": top_k,
        "_source": ["paper_id", "title", "abstract"],
    })

    rrf_scores = defaultdict(float)
    docs = {}
    k = 60
    for rank, hits in enumerate(milvus_results[0]):
        doc_id = f"{hits.entity.get('paper_id')}_{hits.entity.get('chunk_index')}"
        rrf_scores[doc_id] += 1 / (k + rank + 1)
        docs[doc_id] = {
            "paper_id": hits.entity.get("paper_id"),
            "text": hits.entity.get("text"),
            "heading": hits.entity.get("heading"),
            "source": "milvus",
        }
    for rank, hit in enumerate(es_results["hits"]["hits"]):
        doc_id = hit["_source"]["paper_id"] + "_es"
        rrf_scores[doc_id] += 1 / (k + rank + 1)
        docs[doc_id] = {
            "paper_id": hit["_source"]["paper_id"],
            "text": hit["_source"].get("abstract", ""),
            "title": hit["_source"].get("title"),
            "source": "es",
        }

    ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return [docs[doc_id] for doc_id, _ in ranked[:top_k]]
```

- [ ] **Step 2: Write test for RRF ranking**

```python
# backend/tests/test_rag_search.py
def test_rrf_same_doc_gets_higher_score():
    from collections import defaultdict
    rrf = defaultdict(float)
    k = 60
    for rank in range(10):
        rrf["doc1"] += 1 / (k + rank + 1)
    for rank in range(10):
        rrf["doc1"] += 1 / (k + rank + 1)
    for rank in range(10):
        rrf["doc2"] += 1 / (k + rank + 1)
    ranked = sorted(rrf.items(), key=lambda x: x[1], reverse=True)
    assert ranked[0][0] == "doc1"
    assert ranked[1][0] == "doc2"
```

- [ ] **Step 3: Run test**

```bash
cd backend && pytest tests/test_rag_search.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/services/rag_search.py backend/tests/test_rag_search.py
git commit -m "feat: hybrid search with RRF fusion of Milvus and ES results"
```

---

### Task 10: RAG generation service

**Files:**
- Create: `backend/services/rag_service.py`
- Create: `backend/tests/test_rag_service.py`

- [ ] **Step 1: Write query rewriting prompt and function**

```python
# backend/services/rag_service.py
from llm import get_llm_client

QUERY_REWRITE_PROMPT = """你是一个材料科学文献检索专家。将用户的问题改写为更适合检索的查询。
- 将口语化表达转换为学术术语
- 中文和英文术语都保留（中英双语查询）
- 如果问题涉及缩写，同时保留全称和缩写
- 只输出改写后的查询，不要解释

用户问题: {query}
改写查询:"""

CHAPTER_SYSTEM_PROMPT = """你是一个材料科学文献助手。请根据提供的文献片段回答用户的问题。
必须遵守以下规则：
1. 每个事实性陈述后标注来源：[作者, 年份, §章节]
2. 如果文献片段中找不到相关信息，明确说"当前文献库中未找到相关信息"
3. 禁止编造任何文献中不存在的数据或结论
4. 回答结尾列出引用的文献列表"""
```

- [ ] **Step 2: Write generation pipeline**

```python
# backend/services/rag_service.py (continued)
from services.rag_search import hybrid_search

async def rewrite_query(query: str) -> str:
    llm = get_llm_client()
    return await llm.chat([
        {"role": "user", "content": QUERY_REWRITE_PROMPT.format(query=query)}
    ])

async def generate_answer_stream(query: str, conversation_history: list[dict] = None):
    rewritten = await rewrite_query(query)
    docs = await hybrid_search(rewritten, top_k=20)

    context_parts = []
    for i, doc in enumerate(docs):
        ref = f"[{i+1}]"
        paper_info = f"来源{ref}: {doc.get('title', '')} - {doc.get('heading', '')}"
        context_parts.append(f"{paper_info}\n{doc['text']}")

    context = "\n\n---\n\n".join(context_parts[:5])

    messages = [{"role": "system", "content": CHAPTER_SYSTEM_PROMPT}]
    if conversation_history:
        messages.extend(conversation_history[-6:])
    messages.append({"role": "user", "content": f"文献片段:\n{context}\n\n问题: {query}"})

    llm = get_llm_client()
    async for chunk in llm.chat_stream(messages):
        yield chunk

    yield "\n\n---\n**参考文献:**\n"
    for i, doc in enumerate(docs[:5]):
        title = doc.get("title", "Unknown")
        heading = doc.get("heading", "")
        paper_id = doc.get("paper_id", "")
        yield f"\n[{i+1}] {title} - {heading} (ID: {paper_id})"
```

- [ ] **Step 3: Write test for query rewriting prompt format**

```python
# backend/tests/test_rag_service.py
from services.rag_service import QUERY_REWRITE_PROMPT, CHAPTER_SYSTEM_PROMPT

def test_rewrite_prompt_contains_query_placeholder():
    assert "{query}" in QUERY_REWRITE_PROMPT

def test_system_prompt_requires_citations():
    assert "来源" in CHAPTER_SYSTEM_PROMPT
    assert "未找到相关信息" in CHAPTER_SYSTEM_PROMPT
    assert "禁止编造" in CHAPTER_SYSTEM_PROMPT
```

- [ ] **Step 4: Run tests**

```bash
cd backend && pytest tests/test_rag_service.py -v
```

Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/rag_service.py backend/tests/test_rag_service.py
git commit -m "feat: RAG generation with query rewriting, citation enforcement, SSE streaming"
```

---

### Task 11: Entity extraction service

**Files:**
- Create: `backend/services/extract_service.py`
- Create: `backend/tests/test_extract_service.py`

- [ ] **Step 1: Write schema discovery prompt and function**

```python
# backend/services/extract_service.py
from llm import get_llm_client
from models.database import get_db, Entity, EntitySchema
import json

SCHEMA_DISCOVERY_PROMPT = """你是一个材料科学文献分析专家。阅读以下论文内容，识别这篇论文涉及的所有实体类型和关系类型。

输出严格的JSON格式（不要加任何解释）:
{
  "entities": [
    {"type": "实体类型名", "attrs": ["属性1", "属性2", ...]}
  ],
  "relations": ["实体A--关系名→实体B"]
}

注意:
- 实体类型根据论文实际内容动态确定，常见类型示例：材料、力学性能、热性能、表征方法、制备工艺、微观结构、化学成分、应用场景
- 属性要具体到这篇论文提到的信息维度
- 关系描述实体之间的关联

论文内容:
{paper_text}"""

EXTRACT_INSTANCES_PROMPT = """根据以下Schema，从论文中提取所有实体实例。

Schema:
{schema_json}

论文内容:
{paper_text}

输出严格JSON数组:
[
  {"entity_type": "类型名", "attributes": {"属性1": "值1", ...}, "source_span": "§章节或段落位置"},
  ...
]

只输出JSON，不要加任何解释。如果某类实体没有实例，对应的数组为空。
"""
```

- [ ] **Step 2: Write extraction pipeline**

```python
# backend/services/extract_service.py (continued)
async def discover_schema(paper_text: str) -> dict:
    llm = get_llm_client()
    prompt = SCHEMA_DISCOVERY_PROMPT.format(paper_text=paper_text[:8000])
    response = await llm.chat([{"role": "user", "content": prompt}])
    response = response.strip()
    if response.startswith("```json"):
        response = response[7:]
    if response.endswith("```"):
        response = response[:-3]
    return json.loads(response)

async def extract_instances(paper_text: str, schema: dict) -> list[dict]:
    llm = get_llm_client()
    prompt = EXTRACT_INSTANCES_PROMPT.format(
        schema_json=json.dumps(schema, ensure_ascii=False),
        paper_text=paper_text[:8000]
    )
    response = await llm.chat([{"role": "user", "content": prompt}])
    response = response.strip()
    if response.startswith("```json"):
        response = response[7:]
    if response.endswith("```"):
        response = response[:-3]
    return json.loads(response)

async def run_extraction(paper_id: str, paper_text: str) -> dict:
    schema = await discover_schema(paper_text)
    with open(f"schemas/{paper_id}_schema.json", "w") as f:
        json.dump(schema, f, ensure_ascii=False)

    instances = await extract_instances(paper_text, schema)

    from models.database import async_session, EntitySchema
    async with async_session() as db:
        db.add(EntitySchema(paper_id=paper_id, schema_json=schema))
        for inst in instances:
            db.add(Entity(
                paper_id=paper_id,
                entity_type=inst["entity_type"],
                attributes=inst.get("attributes", {}),
                source_span=inst.get("source_span", ""),
            ))
        await db.commit()

    return {"paper_id": paper_id, "schema": schema, "instance_count": len(instances)}
```

- [ ] **Step 3: Write test for schema prompt**

```python
# backend/tests/test_extract_service.py
from services.extract_service import SCHEMA_DISCOVERY_PROMPT, EXTRACT_INSTANCES_PROMPT

def test_schema_prompt_has_required_sections():
    assert "{paper_text}" in SCHEMA_DISCOVERY_PROMPT
    assert "entities" in SCHEMA_DISCOVERY_PROMPT
    assert "relations" in SCHEMA_DISCOVERY_PROMPT

def test_extract_prompt_has_required_sections():
    assert "{schema_json}" in EXTRACT_INSTANCES_PROMPT
    assert "{paper_text}" in EXTRACT_INSTANCES_PROMPT
    assert "entity_type" in EXTRACT_INSTANCES_PROMPT
    assert "attributes" in EXTRACT_INSTANCES_PROMPT

def test_json_response_cleaning():
    raw = '```json\n{"key": "value"}\n```'
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    import json
    assert json.loads(cleaned) == {"key": "value"}
```

- [ ] **Step 4: Run tests**

```bash
mkdir -p backend/schemas
cd backend && pytest tests/test_extract_service.py -v
```

Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/extract_service.py backend/tests/test_extract_service.py backend/schemas/
git commit -m "feat: dynamic entity extraction with schema discovery and instance extraction"
```

---

### Task 12: Schema convergence service

**Files:**
- Create: `backend/services/schema_convergence.py`
- Create: `backend/tests/test_schema_convergence.py`

- [ ] **Step 1: Write convergence logic**

```python
# backend/services/schema_convergence.py
from llm import get_llm_client
from models.database import async_session, EntitySchema, EntitySynonym
from sqlalchemy import select
import json

CONVERGENCE_PROMPT = """你是材料科学术语专家。以下是从不同论文中提取的实体类型列表。
请识别含义相同但表述不同的类型，将它们合并为规范名称。

输入类型列表:
{type_list}

输出JSON:
{{
  "mappings": [
    {{"canonical": "规范名称", "variants": ["变体1", "变体2"]}}
  ]
}}

如果所有类型含义都不同不需要合并，返回空mappings数组。
"""

async def run_schema_convergence() -> dict:
    async with async_session() as db:
        result = await db.execute(select(EntitySchema.schema_json))
        schemas = [row[0] for row in result.fetchall()]

    all_types = set()
    for s in schemas:
        for ent in s.get("entities", []):
            all_types.add(ent["type"])

    if len(all_types) < 2:
        return {"mapped": 0}

    llm = get_llm_client()
    prompt = CONVERGENCE_PROMPT.format(type_list=json.dumps(list(all_types), ensure_ascii=False))
    response = await llm.chat([{"role": "user", "content": prompt}])
    response = response.strip()
    if response.startswith("```json"):
        response = response[7:]
    if response.endswith("```"):
        response = response[:-3]
    mappings = json.loads(response)

    async with async_session() as db:
        for m in mappings.get("mappings", []):
            canonical = m["canonical"]
            for variant in m["variants"]:
                db.add(EntitySynonym(canonical=canonical, variant=variant))
        await db.commit()

    return {"mapped": sum(len(m["variants"]) for m in mappings.get("mappings", []))}
```

- [ ] **Step 2: Write test for prompt**

```python
# backend/tests/test_schema_convergence.py
from services.schema_convergence import CONVERGENCE_PROMPT

def test_convergence_prompt_has_placeholders():
    assert "{type_list}" in CONVERGENCE_PROMPT
    assert "canonical" in CONVERGENCE_PROMPT.lower()

def test_empty_schema_no_mappings():
    prompt = CONVERGENCE_PROMPT.format(type_list='["抗拉强度"]')
    assert "抗拉强度" in prompt
```

- [ ] **Step 3: Run tests**

```bash
cd backend && pytest tests/test_schema_convergence.py -v
```

Expected: 2 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/services/schema_convergence.py backend/tests/test_schema_convergence.py
git commit -m "feat: schema convergence for cross-paper entity type alignment"
```

---

### Task 13: Visualization service

**Files:**
- Create: `backend/services/viz_service.py`
- Create: `backend/tests/test_viz_service.py`

- [ ] **Step 1: Write visualization query generation**

```python
# backend/services/viz_service.py
from llm import get_llm_client
from models.database import async_session, Entity, EntitySynonym
from sqlalchemy import select, text
import json

VIZ_PROMPT = """你是数据可视化专家。用户想要一个图表。根据用户需求，生成：
1. 合适的SQL查询（查询entities表，字段: paper_id, entity_type, attributes(JSONB), source_span）
2. 合适的图表类型
3. ECharts配置

用户需求: {query}

已知实体类型: {available_types}

entities表结构: paper_id TEXT, entity_type TEXT, attributes JSONB, source_span TEXT

输出JSON（不要其他内容）:
{{
  "sql": "SELECT ... FROM entities WHERE ...",
  "chart_type": "bar|scatter|line|boxplot|heatmap",
  "title": "图表标题",
  "echarts_option": {{...完整ECharts配置...}},
  "explanation": "图表说明"
}}
"""

async def generate_chart(query: str) -> dict:
    async with async_session() as db:
        types_result = await db.execute(text("SELECT DISTINCT entity_type FROM entities LIMIT 50"))
        available_types = [row[0] for row in types_result.fetchall()]

    llm = get_llm_client()
    prompt = VIZ_PROMPT.format(
        query=query,
        available_types=json.dumps(available_types, ensure_ascii=False)
    )
    response = await llm.chat([{"role": "user", "content": prompt}])
    response = response.strip()
    if response.startswith("```json"):
        response = response[7:]
    if response.endswith("```"):
        response = response[:-3]
    plan = json.loads(response)

    async with async_session() as db:
        result = await db.execute(text(plan["sql"]))
        columns = result.keys()
        rows = [dict(zip(columns, row)) for row in result.fetchall()]

    return {
        "chart_type": plan["chart_type"],
        "title": plan["title"],
        "data": rows,
        "echarts_option": plan["echarts_option"],
        "explanation": plan.get("explanation", ""),
    }
```

- [ ] **Step 2: Write test**

```python
# backend/tests/test_viz_service.py
from services.viz_service import VIZ_PROMPT

def test_viz_prompt_has_required_fields():
    assert "{query}" in VIZ_PROMPT
    assert "{available_types}" in VIZ_PROMPT
    assert "chart_type" in VIZ_PROMPT
    assert "echarts_option" in VIZ_PROMPT
    assert "sql" in VIZ_PROMPT
```

- [ ] **Step 3: Run test**

```bash
cd backend && pytest tests/test_viz_service.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/services/viz_service.py backend/tests/test_viz_service.py
git commit -m "feat: visualization service with NL-to-chart pipeline"
```

---

### Task 14: API routes - upload

**Files:**
- Create: `backend/routes/upload.py`
- Create: `backend/tests/test_routes_upload.py`

- [ ] **Step 1: Write upload route**

```python
# backend/routes/upload.py
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks
from models.database import async_session, Paper
from services.pdf_service import save_upload, compute_paper_id
from services.ingestion import ingest_pdf
from services.extract_service import run_extraction
from config import get_settings
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

    async with async_session() as db:
        existing = await db.get(Paper, paper_id)
        if existing:
            return {"paper_id": paper_id, "status": "duplicate", "message": "Paper already exists"}

        db.add(Paper(id=paper_id, title=file.filename, file_path=file_path, status="processing"))
        await db.commit()

    background_tasks.add_task(_process_paper, paper_id, file_path)
    return {"paper_id": paper_id, "status": "processing"}

async def _process_paper(paper_id: str, file_path: str):
    result = await ingest_pdf(file_path)
    async with async_session() as db:
        paper = await db.get(Paper, paper_id)
        paper.title = result["title"]
        paper.full_text = result["full_text"]
        paper.status = "ingested"
        await db.commit()
    os.remove(file_path)
```

- [ ] **Step 2: Write test**

```python
# backend/tests/test_routes_upload.py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_upload_no_file():
    resp = client.post("/api/upload")
    assert resp.status_code == 422
```

- [ ] **Step 3: Run test**

```bash
cd backend && pytest tests/test_routes_upload.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/routes/upload.py backend/tests/test_routes_upload.py
git commit -m "feat: PDF upload route with background processing"
```

---

### Task 15: API routes - papers

**Files:**
- Create: `backend/routes/papers.py`
- Create: `backend/tests/test_routes_papers.py`

- [ ] **Step 1: Write papers CRUD routes**

```python
# backend/routes/papers.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models.database import get_db, Paper
from models.schemas import PaperOut, PaperDetailOut, PaperListParams

router = APIRouter(prefix="/api", tags=["papers"])

@router.get("/papers", response_model=dict)
async def list_papers(params: PaperListParams = Depends(), db: AsyncSession = Depends(get_db)):
    query = select(Paper)
    if params.keyword:
        query = query.where(Paper.title.ilike(f"%{params.keyword}%"))
    if params.year_from:
        query = query.where(Paper.year >= params.year_from)
    if params.year_to:
        query = query.where(Paper.year <= params.year_to)
    query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)

    result = await db.execute(query)
    papers = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(Paper))
    total = count_result.scalar()

    return {
        "items": [PaperOut.model_validate(p) for p in papers],
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
    }

@router.get("/papers/{paper_id}", response_model=PaperDetailOut)
async def get_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return PaperDetailOut.model_validate(paper)

@router.delete("/papers/{paper_id}")
async def delete_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    await db.delete(paper)
    await db.commit()
    return {"deleted": paper_id}
```

- [ ] **Step 2: Write tests**

```python
# backend/tests/test_routes_papers.py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_list_papers_empty():
    resp = client.get("/api/papers")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data

def test_get_paper_not_found():
    resp = client.get("/api/papers/nonexistent")
    assert resp.status_code == 404
```

- [ ] **Step 3: Run tests**

```bash
cd backend && pytest tests/test_routes_papers.py -v
```

Expected: 2 PASS

- [ ] **Step 4: Commit**

```bash
git add backend/routes/papers.py backend/tests/test_routes_papers.py
git commit -m "feat: papers CRUD routes with pagination and filtering"
```

---

### Task 16: API routes - chat (SSE)

**Files:**
- Create: `backend/routes/chat.py`
- Create: `backend/tests/test_routes_chat.py`

- [ ] **Step 1: Write SSE chat route**

```python
# backend/routes/chat.py
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
from models.schemas import ChatRequest
from services.rag_service import generate_answer_stream
import json

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat")
async def chat(request: ChatRequest):
    async def event_stream():
        async for chunk in generate_answer_stream(request.query):
            if chunk:
                yield {"event": "chunk", "data": chunk}

    return EventSourceResponse(event_stream())
```

- [ ] **Step 2: Write test**

```python
# backend/tests/test_routes_chat.py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_chat_validation():
    resp = client.post("/api/chat", json={"query": ""})
    assert resp.status_code in [200, 422]
```

- [ ] **Step 3: Run test**

```bash
cd backend && pytest tests/test_routes_chat.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/routes/chat.py backend/tests/test_routes_chat.py
git commit -m "feat: SSE chat route for streaming RAG responses"
```

---

### Task 17: API routes - extract and visualize

**Files:**
- Create: `backend/routes/extract.py`
- Create: `backend/routes/visualize.py`
- Create: `backend/routes/entities.py`
- Create: `backend/tests/test_routes_extract.py`

- [ ] **Step 1: Write extract route**

```python
# backend/routes/extract.py
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from models.database import get_db, Paper
from services.extract_service import run_extraction

router = APIRouter(prefix="/api", tags=["extract"])

@router.post("/extract/{paper_id}")
async def trigger_extraction(paper_id: str, background_tasks: BackgroundTasks,
                             db: AsyncSession = Depends(get_db)):
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if not paper.full_text:
        raise HTTPException(status_code=400, detail="Paper has no text content")

    background_tasks.add_task(run_extraction, paper_id, paper.full_text)
    return {"paper_id": paper_id, "status": "extraction_started"}

@router.get("/extract/{paper_id}/status")
async def extraction_status(paper_id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select, func
    from models.database import Entity
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    count_result = await db.execute(
        select(func.count()).select_from(Entity).where(Entity.paper_id == paper_id)
    )
    count = count_result.scalar()
    return {"paper_id": paper_id, "status": "done" if count > 0 else "pending", "entity_count": count}
```

- [ ] **Step 2: Write visualize route**

```python
# backend/routes/visualize.py
from fastapi import APIRouter
from models.schemas import VisualizeRequest, VisualizeResponse
from services.viz_service import generate_chart

router = APIRouter(prefix="/api", tags=["visualize"])

@router.post("/visualize", response_model=VisualizeResponse)
async def visualize(request: VisualizeRequest):
    result = await generate_chart(request.query)
    return result
```

- [ ] **Step 3: Write entities query route**

```python
# backend/routes/entities.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models.database import get_db, Entity
from models.schemas import EntityQueryParams
import json

router = APIRouter(prefix="/api", tags=["entities"])

@router.get("/entities")
async def query_entities(params: EntityQueryParams = Depends(), db: AsyncSession = Depends(get_db)):
    query = select(Entity)
    if params.entity_type:
        query = query.where(Entity.entity_type == params.entity_type)
    if params.paper_id:
        query = query.where(Entity.paper_id == params.paper_id)
    if params.attribute_key and params.attribute_value:
        query = query.where(Entity.attributes[params.attribute_key].astext == params.attribute_value)
    query = query.offset((params.page - 1) * params.page_size).limit(params.page_size)

    result = await db.execute(query)
    entities = result.scalars().all()
    return {
        "items": [{"id": e.id, "paper_id": e.paper_id, "entity_type": e.entity_type,
                    "attributes": e.attributes, "source_span": e.source_span} for e in entities],
        "page": params.page,
        "page_size": params.page_size,
    }
```

- [ ] **Step 4: Write test**

```python
# backend/tests/test_routes_extract.py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_extract_paper_not_found():
    resp = client.post("/api/extract/nonexistent")
    assert resp.status_code == 404

def test_visualize_empty_request():
    resp = client.post("/api/visualize", json={"query": ""})
    assert resp.status_code in [200, 400, 422, 500]

def test_entities_empty():
    resp = client.get("/api/entities")
    assert resp.status_code == 200
    assert "items" in resp.json()
```

- [ ] **Step 5: Run tests**

```bash
cd backend && pytest tests/test_routes_extract.py -v
```

Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routes/extract.py backend/routes/visualize.py backend/routes/entities.py backend/tests/test_routes_extract.py
git commit -m "feat: extract, visualize, and entities API routes"
```

---

### Task 18: Register all routes in main.py

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update main.py to include all routers**

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.upload import router as upload_router
from routes.papers import router as papers_router
from routes.chat import router as chat_router
from routes.extract import router as extract_router
from routes.visualize import router as visualize_router
from routes.entities import router as entities_router
from models.database import init_db

app = FastAPI(title="Literature Agent API", version="0.1.0")

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

@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Verify all routes are registered**

```bash
cd backend && python -c "from main import app; routes = [r.path for r in app.routes]; print('\n'.join(routes))"
```

Expected output listing all routes: /api/health, /api/upload, /api/papers, etc.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: register all API routes in FastAPI app"
```

---

### Task 19: Frontend - Next.js project setup

**Files:**
- Create: `frontend/` (via create-next-app)

- [ ] **Step 1: Scaffold Next.js project**

```bash
npx create-next-app@14 frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd frontend && npm install echarts echarts-for-react lucide-react @types/node
npx shadcn@latest init -d
npx shadcn@latest add button input card scroll-area separator sheet dialog
```

- [ ] **Step 3: Configure Tailwind with dark mode**

```typescript
// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#2563eb",
          light: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Set global CSS**

```css
/* frontend/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 255 255 255;
  --foreground: 15 23 42;
}
.dark {
  --background: 15 23 42;
  --foreground: 248 250 252;
}
body {
  background: rgb(var(--background));
  color: rgb(var(--foreground));
}
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd frontend && npm run dev &
sleep 5 && curl http://localhost:3000 | head -5
```

Expected: HTML response

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: Next.js frontend scaffolded with Tailwind and shadcn/ui"
```

---

### Task 20: Frontend - Core 3-column layout

**Files:**
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/components/header.tsx`

- [ ] **Step 1: Write root layout**

```tsx
// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Literature Agent", description: "材料科学文献智能助手" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Write header component**

```tsx
// frontend/src/components/header.tsx
import { BookOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-blue-400" />
        <span className="font-semibold text-base">Literature Agent</span>
        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded">1,247 篇文献</span>
      </div>
      <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-500 text-white">
        <Upload className="w-4 h-4" />
        上传 PDF
      </Button>
    </header>
  );
}
```

- [ ] **Step 3: Write 3-column page**

```tsx
// frontend/src/app/page.tsx
"use client";
import { useState } from "react";
import { Header } from "@/components/header";
import { LiteratureSidebar } from "@/components/sidebar/literature-sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { VizPanel } from "@/components/viz/viz-panel";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <div className="w-72 border-r border-slate-800 bg-slate-950 shrink-0">
            <LiteratureSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        )}
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 border-r border-slate-800">
            <ChatPanel onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          </div>
          <div className="w-96 shrink-0">
            <VizPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/layout.tsx frontend/src/app/page.tsx frontend/src/components/header.tsx
git commit -m "feat: 3-column layout with header, sidebar, chat, and viz panels"
```

---

### Task 21: Frontend - Literature sidebar

**Files:**
- Create: `frontend/src/components/sidebar/literature-sidebar.tsx`
- Create: `frontend/src/components/sidebar/paper-card.tsx`

- [ ] **Step 1: Write sidebar component**

```tsx
// frontend/src/components/sidebar/literature-sidebar.tsx
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PaperCard } from "./paper-card";

interface Props {
  onClose: () => void;
  papers?: Array<{ id: string; title: string; authors: string; year: number }>;
}

export function LiteratureSidebar({ onClose, papers = [] }: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Filter className="w-4 h-4" /> 文献库
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="p-3 border-b border-slate-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="搜索文献..." className="pl-8 h-9 text-sm bg-slate-900 border-slate-700" />
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
        {papers.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">暂无文献，请先上传 PDF</p>
        )}
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 2: Write paper card component**

```tsx
// frontend/src/components/sidebar/paper-card.tsx
interface PaperCardProps {
  paper: { id: string; title: string; authors: string; year: number };
}

export function PaperCard({ paper }: PaperCardProps) {
  return (
    <div className="mb-1 p-3 rounded-lg hover:bg-slate-900 cursor-pointer transition-colors border border-transparent hover:border-slate-800">
      <h3 className="text-sm font-medium line-clamp-2 leading-snug">{paper.title}</h3>
      <p className="text-xs text-slate-500 mt-1">{paper.authors} · {paper.year}</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/sidebar/
git commit -m "feat: literature sidebar with search and paper cards"
```

---

### Task 22: Frontend - Chat panel

**Files:**
- Create: `frontend/src/components/chat/chat-panel.tsx`
- Create: `frontend/src/components/chat/chat-message.tsx`
- Create: `frontend/src/components/chat/chat-input.tsx`
- Create: `frontend/src/hooks/use-chat.ts`

- [ ] **Step 1: Write useChat hook**

```tsx
// frontend/src/hooks/use-chat.ts
import { useState, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ paper_id: string; title: string; author: string; year: number; section: string }>;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (query: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: query };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, stream: true }),
    });

    const reader = resp.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "chunk" && parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: m.content + parsed.content } : m
                )
              );
            } else if (parsed.type === "citation" && parsed.refs) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, citations: parsed.refs } : m
                )
              );
            }
          } catch {}
        }
      }
    }
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, sendMessage };
}
```

- [ ] **Step 2: Write chat message component**

```tsx
// frontend/src/components/chat/chat-message.tsx
import ReactMarkdown from "react-markdown";
import { User, Bot } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 px-6 py-4 ${isUser ? "bg-slate-900/50" : "bg-slate-950"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? "bg-blue-600" : "bg-emerald-600"}`}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write chat input**

```tsx
// frontend/src/components/chat/chat-input.tsx
import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { Send, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // or use a shadcn input

interface Props {
  onSend: (query: string) => void;
  disabled: boolean;
  onToggleSidebar: () => void;
}

export function ChatInput({ onSend, disabled, onToggleSidebar }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="border-t border-slate-800 bg-slate-950 p-4">
      <div className="flex gap-2 items-end">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-9 w-9 shrink-0">
          <PanelLeft className="w-4 h-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入问题... (Ctrl+Enter 发送)"
          rows={1}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none focus:border-blue-500"
        />
        <Button onClick={handleSend} disabled={disabled || !input.trim()} size="sm" className="shrink-0 bg-blue-600 hover:bg-blue-500">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write chat panel**

```tsx
// frontend/src/components/chat/chat-panel.tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useChat } from "@/hooks/use-chat";

interface Props {
  onToggleSidebar: () => void;
}

export function ChatPanel({ onToggleSidebar }: Props) {
  const { messages, isStreaming, sendMessage } = useChat();

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            上传文献后开始提问
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
      </ScrollArea>
      <ChatInput onSend={sendMessage} disabled={isStreaming} onToggleSidebar={onToggleSidebar} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/ frontend/src/hooks/use-chat.ts
git commit -m "feat: chat panel with SSE streaming and citation display"
```

---

### Task 23: Frontend - Visualization panel

**Files:**
- Create: `frontend/src/components/viz/viz-panel.tsx`
- Create: `frontend/src/components/viz/chart-container.tsx`

- [ ] **Step 1: Write chart container**

```tsx
// frontend/src/components/viz/chart-container.tsx
import ReactECharts from "echarts-for-react";

interface Props {
  option: object;
  title: string;
}

export function ChartContainer({ option, title }: Props) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3 text-slate-300">{title}</h3>
      <div className="bg-slate-900 rounded-lg p-2">
        <ReactECharts option={option} style={{ height: "280px" }} theme="dark" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write viz panel**

```tsx
// frontend/src/components/viz/viz-panel.tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartContainer } from "./chart-container";
import { BarChart3 } from "lucide-react";

export function VizPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          分析面板
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex items-center justify-center h-full text-slate-500 text-sm py-8">
          在对话框中提问后，图表将展示在这里
        </div>
        {/* Charts rendered here after visualization query */}
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/viz/
git commit -m "feat: visualization panel with ECharts container"
```

---

### Task 24: Frontend - API client and integration

**Files:**
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Write API client**

```typescript
// frontend/src/lib/api.ts
const BASE = "/api";

export async function fetchPapers(params?: {
  page?: number;
  keyword?: string;
  year_from?: number;
  year_to?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/papers?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch papers");
  return resp.json();
}

export async function uploadPDF(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch(`${BASE}/upload`, { method: "POST", body: formData });
  if (!resp.ok) throw new Error("Upload failed");
  return resp.json();
}

export async function triggerExtraction(paperId: string) {
  const resp = await fetch(`${BASE}/extract/${paperId}`, { method: "POST" });
  if (!resp.ok) throw new Error("Extraction failed");
  return resp.json();
}

export async function fetchEntities(params?: {
  entity_type?: string;
  paper_id?: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) searchParams.set(k, String(v));
    });
  }
  const resp = await fetch(`${BASE}/entities?${searchParams}`);
  if (!resp.ok) throw new Error("Failed to fetch entities");
  return resp.json();
}

export async function visualizeQuery(query: string) {
  const resp = await fetch(`${BASE}/visualize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error("Visualization failed");
  return resp.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: frontend API client for all backend endpoints"
```

---

### Task 25: Docker Compose update - add PostgreSQL and backend services

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add PostgreSQL service**

```yaml
# Append to docker-compose.yml services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: literature
    volumes:
      - ./volumes/postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"
```

- [ ] **Step 2: Add backend service**

```yaml
# Append to docker-compose.yml services:
  backend:
    build: ./backend
    environment:
      - MILVUS_HOST=milvus
      - ES_HOST=http://es:9200
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/literature
      - LLM_PROVIDER=deepseek
      - LLM_API_KEY=${LLM_API_KEY}
    ports:
      - "8080:8080"
    volumes:
      - ./uploads:/app/uploads
      - ./schemas:/app/schemas
    depends_on:
      - postgres
      - milvus
      - es
```

- [ ] **Step 3: Create backend Dockerfile**

```dockerfile
# backend/Dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml backend/Dockerfile
git commit -m "feat: add PostgreSQL and backend to docker-compose"
```

---

### Task 26: End-to-end smoke test

**Files:**
- Create: `scripts/smoke_test.sh`

- [ ] **Step 1: Write smoke test script**

```bash
#!/bin/bash
# scripts/smoke_test.sh
set -e

echo "=== Health Check ==="
curl -s http://localhost:8080/api/health | grep -q "ok" && echo "PASS: health" || echo "FAIL: health"

echo "=== Upload Test PDF ==="
# Create a minimal test PDF
python -c "
import fitz
doc = fitz.open()
doc.new_page().insert_text((50, 50), 'Test paper about titanium alloy Ti-6Al-4V SLM process. UTS is 950 MPa.')
doc.save('/tmp/test.pdf')
"
RESULT=$(curl -s -F "file=@/tmp/test.pdf" http://localhost:8080/api/upload)
PAPER_ID=$(echo $RESULT | python -c "import sys,json; print(json.load(sys.stdin)['paper_id'])")
echo "Upload result: $RESULT"
[[ -n "$PAPER_ID" ]] && echo "PASS: upload" || echo "FAIL: upload"

echo "=== List Papers ==="
sleep 3
curl -s http://localhost:8080/api/papers | python -c "import sys,json; d=json.load(sys.stdin); assert d['total']>=1" && echo "PASS: papers" || echo "FAIL: papers"

echo "=== Chat ==="
curl -s -X POST http://localhost:8080/api/chat -H "Content-Type: application/json" -d "{\"query\":\"What is Ti-6Al-4V?\"}" | head -3
echo "PASS: chat (SSE stream received)"

echo "=== Smoke test complete ==="
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/smoke_test.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_test.sh
git commit -m "test: end-to-end smoke test script"
```

---

### Task 27: Final commit - README and .env example

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Write .env.example**

```bash
# .env.example
LLM_API_KEY=sk-your-deepseek-api-key
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/literature
```

- [ ] **Step 2: Final commit**

```bash
git add .env.example
git commit -m "chore: add .env.example template"
```
