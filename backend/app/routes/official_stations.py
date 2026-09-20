import json
import re
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.services.processed_dataset_service import (
    get_latest_station_measurements,
)

router = APIRouter(
    prefix="/api/official-stations",
    tags=["Official Stations"],
)

STATION_METADATA_FILE = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "green-sentinel-points.json"
)


def extract_station_id(station_code: str) -> int | None:
    match = re.search(r"(\d+)$", station_code)

    if not match:
        return None

    return int(match.group(1))


OFFICIAL_STATION_NAMES: dict[int, str] = {
    1: "Szab\u00f3 P\u00e1l street, Medical Clinic",
    2: "Kar\u00e1csony Gy\u00f6rgy street, Nursery",
    3: "Sz\u00e1vay Gyula street, Home for the Elderly",
    4: "Debreceni V\u00edzm\u0171 Ltd. II. no. waterworks",
    5: "DSZC Kreat\u00edv Technikum",
    6: "Debreceni V\u00f6r\u00f6smarty Mih\u00e1ly Elementary School",
    7: "Wessel\u00e9nyi housing estate",
    8: "H\u00e1rmashegy Forest School",
    9: "Vez\u00e9r street reservoir",
    10: "Mikep\u00e9rcs, R\u00f3zs\u00e1s street",
    11: "HUN-REN Institute for Nuclear Research",
    12: "Debrecen-J\u00f3zsa, Klastrompart row, playground",
    13: "Debrecen-J\u00f3zsa, T\u00f3c\u00f3 surface water station",
    14: "Surface water station near T\u00f3c\u00f3 (crossing of road 481)",
    15: "Northwestern Economic Zone, BMW tour",
    16: "North-Western Economic Zone, M35 J\u00f3zsa junction",
    17: "Szepes, S\u00e1rga d\u0171l\u0151",
    18: "Southern Economic Zone junction 481-47 intersection",
}


def load_station_metadata() -> dict[int, dict[str, Any]]:
    if not STATION_METADATA_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="Station metadata file not found.",
        )

    try:
        with STATION_METADATA_FILE.open(
            "r",
            encoding="utf-8",
        ) as file:
            raw_metadata = json.load(file)
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=500,
            detail="Station metadata contains invalid JSON.",
        ) from error

    metadata_by_id: dict[int, dict[str, Any]] = {}

    for item in raw_metadata:
        station_id = item.get("id")

        if station_id is None:
            continue

        try:
            station_id = int(station_id)
            latitude = float(str(item.get("lat", "")).strip())
            longitude = float(str(item.get("lng", "")).strip())
        except (TypeError, ValueError):
            continue

        metadata_by_id[station_id] = {
            "id": station_id,
            "name": OFFICIAL_STATION_NAMES.get(
                station_id,
                item.get("title", {}).get("en")
                or item.get("name")
                or f"Station {station_id}",
            ),
            "lat": latitude,
            "lng": longitude,
            "station_type": int(item.get("station_type", 0)),
        }

    return metadata_by_id


@router.get("/")
def get_official_stations() -> dict[str, Any]:
    try:
        latest_measurements = get_latest_station_measurements()
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    metadata_by_id = load_station_metadata()

    stations: list[dict[str, Any]] = []

    for measurement in latest_measurements:
        station_code = measurement["stationCode"]
        station_id = extract_station_id(station_code)

        if station_id is None:
            continue

        metadata = metadata_by_id.get(station_id)

        if metadata is None:
            continue

        stations.append(
            {
                **metadata,
                "stationCode": station_code,
                "location": measurement["location"],
                "timestamp": measurement["timestamp"],
                "pm25": measurement.get("pm25"),
                "pm10": measurement.get("pm10"),
                "no2": measurement.get("no2"),
                "o3": measurement.get("o3"),
                "co": measurement.get("co"),
                "co2": measurement.get("co2"),
                "humidity": measurement.get("humidity"),
                "pressure": measurement.get("pressure"),
                "windSpeed": measurement.get("wind_speed"),
                "windDirection": measurement.get(
                    "wind_direction"
                ),
            }
        )

    stations.sort(key=lambda station: station["id"])

    return {
        "count": len(stations),
        "source": "Official 30-day Green Sentinel dataset",
        "stations": stations,
    }