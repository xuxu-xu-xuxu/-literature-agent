from fastapi import APIRouter
from backend.models.schemas import VisualizeRequest, VisualizeResponse
from backend.services.viz_service import generate_chart

router = APIRouter(prefix="/api", tags=["visualize"])


@router.post("/visualize")
async def visualize(request: VisualizeRequest):
    result = await generate_chart(request.query)
    return result
