import uuid

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Text, String, DateTime, JSON, Integer, ForeignKey, Float, Boolean, text
from datetime import datetime, timezone

from backend.config import get_settings


def _new_uuid() -> str:
    return uuid.uuid4().hex

_engine = None
_async_session = None


def _get_engine():
    global _engine, _async_session
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(settings.database_url, echo=False)
        _async_session = async_sessionmaker(
            _engine, class_=AsyncSession, expire_on_commit=False
        )
    return _engine, _async_session

class Base(DeclarativeBase):
    pass

DEFAULT_LIBRARY_DOMAINS = [
    {"id": "solid-state", "name": "固态电池", "description": "固态电池与固态电解质相关文献", "color": "#1a2744", "sort_order": 1, "is_default": True},
    {"id": "electrocatalysis", "name": "电催化", "description": "电催化、析氢、CO2 还原等方向", "color": "#2c5282", "sort_order": 2, "is_default": True},
    {"id": "writing-tips", "name": "写作技巧", "description": "论文写作、表达、审稿与排版经验", "color": "#4c51bf", "sort_order": 3, "is_default": True},
    {"id": "unclassified", "name": "未分类", "description": "尚未指定领域的文献", "color": "#64748b", "sort_order": 99, "is_default": True},
]

async def init_db():
    engine, _ = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _patch_existing_schema(conn)
    await _seed_default_domains()

async def _patch_existing_schema(conn):
    dialect = conn.dialect.name
    if dialect != "postgresql":
        return
    await conn.execute(text("ALTER TABLE solid_electrolyte_records ADD COLUMN IF NOT EXISTS is_crystalline BOOLEAN"))
    await conn.execute(text("ALTER TABLE solid_electrolyte_records ADD COLUMN IF NOT EXISTS crystallinity VARCHAR(64) DEFAULT 'unknown'"))
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS paper_tags (
            id SERIAL PRIMARY KEY,
            paper_id VARCHAR(64) NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            tag VARCHAR(128) NOT NULL,
            source VARCHAR(16) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_paper_tag ON paper_tags(paper_id, tag)"))


async def _seed_default_domains():
    async for db in get_db():
        existing = (await db.execute(text("SELECT id FROM library_domains LIMIT 1"))).first()
        if existing:
            break
        for domain in DEFAULT_LIBRARY_DOMAINS:
            db.add(LibraryDomain(**domain))
        await db.commit()
        break

async def get_db() -> AsyncSession:
    _, async_session = _get_engine()
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class LibraryDomain(Base):
    __tablename__ = "library_domains"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(32), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class PaperDomainAssignment(Base):
    __tablename__ = "paper_domain_assignments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[str] = mapped_column(String(64), ForeignKey("papers.id", ondelete="CASCADE"), unique=True, nullable=False)
    domain_id: Mapped[str] = mapped_column(String(64), ForeignKey("library_domains.id", ondelete="CASCADE"), nullable=False)
    assigned_by: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Entity(Base):
    __tablename__ = "entities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[str] = mapped_column(String(64), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(256), nullable=False)
    attributes: Mapped[dict] = mapped_column(JSON, nullable=False)
    source_span: Mapped[str] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class EntitySchema(Base):
    __tablename__ = "entity_schemas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[str] = mapped_column(String(64), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    schema_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class EntitySynonym(Base):
    __tablename__ = "entity_synonyms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    canonical: Mapped[str] = mapped_column(String(256), nullable=False)
    variant: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    total: Mapped[int] = mapped_column(Integer, default=0)
    succeeded: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    duplicate: Mapped[int] = mapped_column(Integer, default=0)
    current_file: Mapped[str] = mapped_column(String(1024), nullable=True)
    error: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class PaperProcessingTask(Base):
    __tablename__ = "paper_processing_tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), ForeignKey("ingestion_jobs.id", ondelete="CASCADE"), nullable=False)
    paper_id: Mapped[str] = mapped_column(String(64), nullable=True)
    filename: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    stage: Mapped[str] = mapped_column(String(64), nullable=True)
    error: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class DownloadedPaper(Base):
    __tablename__ = "downloaded_papers"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_new_uuid)
    identifier: Mapped[str] = mapped_column(String(512), nullable=False)
    doi: Mapped[str] = mapped_column(String(512), nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(128), nullable=True)
    strategy: Mapped[str] = mapped_column(String(32), default="legal_only")
    file_path: Mapped[str] = mapped_column(String(1024), nullable=True)
    paper_id: Mapped[str] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    error: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SolidElectrolyteRecord(Base):
    __tablename__ = "solid_electrolyte_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[str] = mapped_column(String(64), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    material_formula: Mapped[str] = mapped_column(String(256), nullable=False)
    normalized_formula: Mapped[str] = mapped_column(String(256), nullable=True)
    elements: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    conductivity_value: Mapped[float] = mapped_column(Float, nullable=True)
    conductivity_unit: Mapped[str] = mapped_column(String(64), nullable=True)
    conductivity_s_cm: Mapped[float] = mapped_column(Float, nullable=True)
    temperature_value: Mapped[float] = mapped_column(Float, nullable=True)
    temperature_unit: Mapped[str] = mapped_column(String(32), nullable=True)
    temperature_k: Mapped[float] = mapped_column(Float, nullable=True)
    method: Mapped[str] = mapped_column(String(64), default="unknown")
    method_detail: Mapped[str] = mapped_column(Text, nullable=True)
    is_crystalline: Mapped[bool] = mapped_column(Boolean, nullable=True)
    crystallinity: Mapped[str] = mapped_column(String(64), default="unknown")
    evidence_text: Mapped[str] = mapped_column(Text, nullable=False)
    page_or_section: Mapped[str] = mapped_column(String(256), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_new_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(256), default="新对话")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(64), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PaperTag(Base):
    __tablename__ = "paper_tags"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[str] = mapped_column(String(64), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    tag: Mapped[str] = mapped_column(String(128), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
