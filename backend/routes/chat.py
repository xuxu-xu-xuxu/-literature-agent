from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
from backend.models.schemas import ChatRequest
from backend.services.rag_service import generate_answer_stream

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(request: ChatRequest):
    async def event_stream():
        async for chunk in generate_answer_stream(request.query):
            if chunk:
                yield {"event": "chunk", "data": chunk}

    return EventSourceResponse(event_stream())
