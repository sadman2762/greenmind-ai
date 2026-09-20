from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd


PROCESSED_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "processed"
    / "air_measurements_wide.csv"
)


@lru_cache(maxsize=1)
def load_processed_air_data() -> pd.DataFrame:
    if not PROCESSED_FILE.exists():
        raise FileNotFoundError(
            f"Processed dataset not found: {PROCESSED_FILE}"
        )

    return pd.read_csv(
        PROCESSED_FILE,
        parse_dates=["timestamp"],
        encoding="utf-8",
    )


@lru_cache(maxsize=1)
def get_latest_station_measurements() -> list[dict[str, Any]]:
    data = load_processed_air_data()

    latest_rows = (
        data.sort_values("timestamp")
        .groupby("station_code", as_index=False)
        .tail(1)
        .sort_values("station_code")
    )

    measurement_columns = [
        "pm25",
        "pm10",
        "no2",
        "o3",
        "co",
        "co2",
        "humidity",
        "pressure",
        "wind_speed",
        "wind_direction",
    ]

    stations: list[dict[str, Any]] = []

    for _, row in latest_rows.iterrows():
        station = {
            "stationCode": row["station_code"],
            "location": row["location"],
            "timestamp": row["timestamp"].isoformat(),
        }

        for column in measurement_columns:
            value = row.get(column)

            station[column] = (
                None
                if pd.isna(value)
                else round(float(value), 2)
            )

        stations.append(station)

    return stations


@lru_cache(maxsize=1)
def get_dataset_summary() -> dict[str, Any]:
    data = load_processed_air_data()

    metadata_columns = {
        "timestamp",
        "location",
        "station_code",
        "source_file",
    }

    return {
        "rows": len(data),
        "stations": int(data["station_code"].nunique()),
        "startTimestamp": data["timestamp"].min().isoformat(),
        "endTimestamp": data["timestamp"].max().isoformat(),
        "measurementColumns": [
            column
            for column in data.columns
            if column not in metadata_columns
        ],
        "missingValues": {
            column: int(data[column].isna().sum())
            for column in data.columns
        },
    }


def clear_processed_dataset_cache() -> None:
    load_processed_air_data.cache_clear()
    get_latest_station_measurements.cache_clear()
    get_dataset_summary.cache_clear()