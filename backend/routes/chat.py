from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
from backend.models.schemas import ChatRequest
from backend.services.rag_service import generate_answer_stream

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(request: ChatRequest):
    async def event_stream():
        try:
            async for chunk in generate_answer_stream(request.query):
                if chunk:
                    yield {"event": "chunk", "data": chunk}
        except Exception as exc:
            yield {
                "event": "chunk",
                "data": f"\n[回答出错：{exc}。请检查 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 配置。]",
            }

    return EventSourceResponse(event_stream())
