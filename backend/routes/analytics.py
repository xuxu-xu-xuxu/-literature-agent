from fastapi import APIRouter, Depends

from backend.models.schemas import AnalyticsQueryParams, RecordQueryParams
from backend.services.analytics import by_element, by_method, by_temperature, records_response
from backend.services.solid_electrolyte_properties.analytics import (
    conductivity_by_element as property_conductivity_by_element,
    conductivity_by_material,
    element_frequency,
    electrochemical_window_by_material,
    records_response as property_records_response,
)

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


@router.get("/properties")
async def list_property_records(
    property_name: str | None = None,
    confidence_min: float = 0.0,
    status: str | None = None,
    page: int = 1,
    page_size: int = 100,
):
    return await property_records_response(property_name, confidence_min, status, page, page_size)


@router.get("/properties/conductivity/by-material")
async def property_conductivity_by_material(confidence_min: float = 0.0):
    return await conductivity_by_material(confidence_min)


@router.get("/properties/conductivity/by-element")
async def property_conductivity_by_element_route(metric: str = "avg", confidence_min: float = 0.0):
    return await property_conductivity_by_element(metric, confidence_min)


@router.get("/properties/elements/frequency")
async def property_element_frequency(confidence_min: float = 0.0):
    return await element_frequency(confidence_min)


@router.get("/properties/electrochemical-window/by-material")
async def property_electrochemical_window_by_material(confidence_min: float = 0.0):
    return await electrochemical_window_by_material(confidence_min)
