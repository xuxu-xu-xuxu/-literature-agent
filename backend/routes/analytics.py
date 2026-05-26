from fastapi import APIRouter, Depends

from backend.models.schemas import AnalyticsQueryParams, RecordQueryParams
from backend.services.analytics import by_element, by_method, by_temperature, records_response

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/records")
async def list_records(params: RecordQueryParams = Depends()):
    return await records_response(params)


@router.get("/conductivity/by-element")
async def conductivity_by_element(params: AnalyticsQueryParams = Depends()):
    return await by_element(params)


@router.get("/conductivity/by-method")
async def conductivity_by_method(params: AnalyticsQueryParams = Depends()):
    return await by_method(params)


@router.get("/conductivity/by-temperature")
async def conductivity_by_temperature(params: AnalyticsQueryParams = Depends()):
    return await by_temperature(params)
