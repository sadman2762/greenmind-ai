from typing import Any, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.sensor_health_service import (
    decommission_sensor,
    get_sensor_health_report,
    register_custom_sensor,
)

router = APIRouter(
    prefix="/api/sensor-health",
    tags=["Sensor Health & Predictive Maintenance"],
)


class RegisterSensorPayload(BaseModel):
    stationCode: Optional[str] = None
    name: str
    sensorCategory: str = "AIR"  # AIR, NOISE, WATER
    sensorType: Optional[str] = "Tier 2: Micro Optical Particle Counter"
    latitude: float = 47.5316
    longitude: float = 21.6273
    healthScore: Optional[int] = 98
    estimatedDaysToService: Optional[int] = 180


@router.get("/")
def get_sensor_health() -> dict[str, Any]:
    """
    Returns Machine Learning Predictive Maintenance (PdM) diagnostics,
    Remaining Useful Life (RUL) estimates, and field technician work orders
    for the Debrecen municipal environmental sensor fleet.
    """
    return get_sensor_health_report()


@router.post("/stations")
def add_new_sensor(payload: RegisterSensorPayload) -> dict[str, Any]:
    """
    Registers a new physical or virtual sensor into the Debrecen
    monitored fleet with calibrated prognostic baselines.
    """
    new_station = register_custom_sensor(payload.model_dump())
    return {
        "message": f"Sensor {new_station['stationCode']} successfully registered into fleet.",
        "station": new_station,
        "fleetReport": get_sensor_health_report(),
    }


@router.delete("/stations/{station_code}")
def remove_sensor(station_code: str) -> dict[str, Any]:
    """
    Decommissions a sensor from the Debrecen active fleet, removing it from
    telemetry diagnostics and predictive maintenance streams.
    """
    decommission_sensor(station_code)
    return {
        "message": f"Sensor {station_code} successfully decommissioned.",
        "removedStationCode": station_code,
        "fleetReport": get_sensor_health_report(),
    }

