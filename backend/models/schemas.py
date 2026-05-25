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
    type: str
    content: Optional[str] = None
    refs: Optional[list[dict]] = None

class ExtractRequest(BaseModel):
    paper_id: str

class ExtractStatus(BaseModel):
    paper_id: str
    status: str
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

class AnalyticsQueryParams(BaseModel):
    metric: str = Field(default="avg", pattern="^(avg|median)$")
    method: Optional[str] = None
    element: Optional[str] = None
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    confidence_min: float = Field(default=0.7, ge=0, le=1)

class RecordQueryParams(BaseModel):
    paper_id: Optional[str] = None
    method: Optional[str] = None
    element: Optional[str] = None
    confidence_min: float = Field(default=0.0, ge=0, le=1)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=500)
