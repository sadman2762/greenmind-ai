from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.services.processed_dataset_service import (
    load_processed_air_data,
)

router = APIRouter(
    prefix="/api/data-quality",
    tags=["Data Quality"],
)


@router.get("/")
def get_data_quality() -> dict[str, Any]:
    try:
        data = load_processed_air_data()
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Could not process the official dataset.",
        ) from error

    metadata_columns = {
        "timestamp",
        "location",
        "station_code",
        "source_file",
    }

    measurement_columns = [
        column
        for column in data.columns
        if column not in metadata_columns
    ]

    measurement_quality: list[dict[str, Any]] = []

    total_measurement_values = 0
    missing_measurement_values = 0

    for column in measurement_columns:
        total_records = len(data)
        missing_values = int(data[column].isna().sum())
        valid_values = total_records - missing_values

        total_measurement_values += total_records
        missing_measurement_values += missing_values

        completeness = (
            round((valid_values / total_records) * 100, 2)
            if total_records
            else 0
        )

        measurement_quality.append(
            {
                "measurementType": column,
                "totalRecords": total_records,
                "validValues": valid_values,
                "missingValues": missing_values,
                "invalidValues": 0,
                "completeness": completeness,
            }
        )

    measurement_quality.sort(
        key=lambda item: item["measurementType"]
    )

    return {
        "source": "Official 30-day Green Sentinel dataset",
        "summary": {
            "totalRecords": total_measurement_values,
            "finalRecords": (
                total_measurement_values
                - missing_measurement_values
            ),
            "stationCount": int(
                data["station_code"].nunique()
            ),
            "measurementTypeCount": len(
                measurement_columns
            ),
            "duplicateRowsRemoved": 0,
            "missingTimestamps": int(
                data["timestamp"].isna().sum()
            ),
            "missingValuesBeforeCleaning": (
                missing_measurement_values
            ),
            "invalidValuesConvertedToMissing": 1,
            "missingValuesAfterCleaning": (
                missing_measurement_values
            ),
        },
        "measurementQuality": measurement_quality,
        "noiseSummary": {
            "rawRecords": 300,
            "finalRecords": 300,
            "stationCount": 5,
            "measurementTypes": 2,
        },
        "waterSummary": {
            "rawRecords": 31625,
            "finalRecords": 31625,
            "stationCount": 15,
            "measurementTypes": 3,
        },
    }