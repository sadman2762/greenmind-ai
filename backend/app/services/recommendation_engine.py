from __future__ import annotations

import csv
import re
from functools import lru_cache
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any

import numpy as np
from scipy.spatial import cKDTree

from app.services.ml_placement_service import ml_engine

EARTH_RADIUS_KM = 6371.0

# Debrecen municipal urban & suburban monitoring agglomeration
# Constrained strictly to Debrecen city limits and suburban/industrial corridors
# (strictly excluding distant neighbouring municipalities like Hajdúböszörmény, Hajdúsámson, Téglás)
CENTER_LAT = 47.5316
CENTER_LNG = 21.6273
MAX_URBAN_RADIUS_KM = 8.2  # Covers entire Debrecen urban area, BMW park, Józsa, Déli Industrial Park, Airport

MIN_LAT = 47.452
MAX_LAT = 47.602
MIN_LNG = 21.512
MAX_LNG = 21.722
GRID_STEP = 0.0055  # ~500m high-fidelity resolution within Debrecen urban bounds

DEBRECEN_BOUNDARY_RING: list[tuple[float, float]] = [
    (21.54637, 47.67154),
    (21.55903, 47.70191),
    (21.60965, 47.70697),
    (21.62737, 47.66141),
    (21.65015, 47.61585),
    (21.67799, 47.59054),
    (21.72355, 47.60826),
    (21.75646, 47.63610),
    (21.79189, 47.64369),
    (21.82986, 47.61079),
    (21.86276, 47.57029),
    (21.86023, 47.50701),
    (21.83998, 47.46905),
    (21.77164, 47.41589),
    (21.73114, 47.44373),
    (21.69318, 47.43867),
    (21.63749, 47.39058),
    (21.57675, 47.39058),
    (21.56409, 47.43108),
    (21.53878, 47.44373),
    (21.50723, 47.45293),
    (21.48698, 47.50102),
    (21.41864, 47.50102),
    (21.41611, 47.55164),
    (21.43889, 47.60986),
    (21.48056, 47.69179),
    (21.52359, 47.72216),
    (21.54384, 47.73228),
    (21.53119, 47.67913),
    (21.54637, 47.67154),
]


def is_inside_debrecen(lat: float, lng: float) -> bool:
    """Ray casting algorithm to test if (lat, lng) is inside Debrecen municipal polygon."""
    inside = False
    n = len(DEBRECEN_BOUNDARY_RING)
    for i in range(n):
        j = (i - 1) % n
        xi, yi = DEBRECEN_BOUNDARY_RING[i]
        xj, yj = DEBRECEN_BOUNDARY_RING[j]
        crosses = (yi > lat) != (yj > lat)
        if crosses:
            intersect_x = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lng < intersect_x:
                inside = not inside
    return inside


def lat_lng_to_cartesian(
    latitudes: np.ndarray | float,
    longitudes: np.ndarray | float,
) -> np.ndarray:
    """
    Convert (lat, lng) in degrees to 3D Earth Cartesian (x, y, z) in kilometers.
    """
    lat_arr = np.atleast_1d(np.asarray(latitudes, dtype=np.float64))
    lng_arr = np.atleast_1d(np.asarray(longitudes, dtype=np.float64))
    lat_rad = np.radians(lat_arr)
    lng_rad = np.radians(lng_arr)
    x = EARTH_RADIUS_KM * np.cos(lat_rad) * np.cos(lng_rad)
    y = EARTH_RADIUS_KM * np.cos(lat_rad) * np.sin(lng_rad)
    z = EARTH_RADIUS_KM * np.sin(lat_rad)
    return np.column_stack([x, y, z])


def chord_to_km(
    chord_dist: float | np.ndarray,
) -> float | np.ndarray:
    """
    Convert 3D Euclidean chord distance to spherical Great Circle distance (km).
    """
    val = np.clip(chord_dist / (2.0 * EARTH_RADIUS_KM), 0.0, 1.0)
    return 2.0 * EARTH_RADIUS_KM * np.arcsin(val)


def km_to_chord(km_dist: float) -> float:
    """
    Convert spherical Great Circle distance (km) to 3D Euclidean chord distance.
    """
    return 2.0 * EARTH_RADIUS_KM * sin(km_dist / (2.0 * EARTH_RADIUS_KM))

# Green Sentinel interpolation settings
MAX_INTERPOLATION_DISTANCE_KM = 15.0
NEAREST_STATION_COUNT = 5

# DKV transport influence settings
TRAFFIC_SEARCH_RADIUS_KM = 2.0
MAX_NEARBY_TRAFFIC_STOPS = 10
MIN_TRAFFIC_DISTANCE_KM = 0.10

# Project root:
# GREENMIND-AI/
#
# This file:
# GREENMIND-AI/backend/app/services/recommendation_engine.py
PROJECT_ROOT = Path(__file__).resolve().parents[3]

TRAFFIC_DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "traffic_activity.csv"
)

NOISE_DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "noise_measurements_cleaned.csv"
)

WATER_DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "water_measurements_cleaned.csv"
)

LOCATION_COORDINATE_PATTERN = re.compile(
    r"\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)\s*$"
)


def calculate_distance_km(
    latitude_1: float,
    longitude_1: float,
    latitude_2: float,
    longitude_2: float,
) -> float:
    """
    Calculate geographic distance using the Haversine formula.
    """

    latitude_difference = radians(
        latitude_2 - latitude_1
    )
    longitude_difference = radians(
        longitude_2 - longitude_1
    )

    first_latitude = radians(latitude_1)
    second_latitude = radians(latitude_2)

    value = (
        sin(latitude_difference / 2) ** 2
        + cos(first_latitude)
        * cos(second_latitude)
        * sin(longitude_difference / 2) ** 2
    )

    value = max(0.0, min(1.0, value))

    return (
        2
        * EARTH_RADIUS_KM
        * asin(sqrt(value))
    )


def normalize(
    value: float,
    minimum: float,
    maximum: float,
) -> float:
    """
    Normalize a value to the range 0-100.
    """

    if maximum <= minimum:
        return 0.0

    normalized = (
        (value - minimum)
        / (maximum - minimum)
        * 100
    )

    return max(
        0.0,
        min(100.0, normalized),
    )


def round_optional(
    value: float | None,
    decimals: int = 2,
) -> float:
    if value is None:
        return 0.0

    return round(value, decimals)


def safe_float(
    value: Any,
) -> float | None:
    """
    Convert a value to float without allowing invalid,
    infinite or missing values to break the engine.
    """

    if value is None:
        return None

    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None

    if numeric_value != numeric_value:
        return None

    if numeric_value in (
        float("inf"),
        float("-inf"),
    ):
        return None

    return numeric_value


def generate_city_grid() -> list[dict[str, float | int]]:
    points: list[dict[str, float | int]] = []
    point_id = 1
    latitude = MIN_LAT

    while latitude <= MAX_LAT + 1e-9:
        longitude = MIN_LNG

        while longitude <= MAX_LNG + 1e-9:
            # Enforce that candidates stay strictly within the Debrecen urban & suburban perimeter
            dist_to_center = calculate_distance_km(latitude, longitude, CENTER_LAT, CENTER_LNG)
            if dist_to_center <= MAX_URBAN_RADIUS_KM and is_inside_debrecen(latitude, longitude):
                points.append(
                    {
                        "id": point_id,
                        "lat": round(latitude, 6),
                        "lng": round(longitude, 6),
                    }
                )
                point_id += 1

            longitude += GRID_STEP

        latitude += GRID_STEP

    return points


# =========================================================
# DKV TRANSPORT DATA
# =========================================================


@lru_cache(maxsize=1)
def load_traffic_locations() -> tuple[
    dict[str, Any],
    ...,
]:
    """
    Load the processed DKV traffic dataset once and cache it.

    Expected CSV columns:
    - stop_name
    - longitude
    - latitude
    - traffic_activity_score
    - passenger_frequency_total
    - passengers_in_total
    - passengers_out_total
    """

    if not TRAFFIC_DATA_PATH.exists():
        print(
            "Warning: DKV traffic dataset was not found at "
            f"{TRAFFIC_DATA_PATH}"
        )
        return tuple()

    traffic_locations: list[dict[str, Any]] = []

    try:
        with TRAFFIC_DATA_PATH.open(
            mode="r",
            encoding="utf-8-sig",
            newline="",
        ) as csv_file:
            reader = csv.DictReader(csv_file)

            for row in reader:
                latitude = safe_float(
                    row.get("latitude")
                )
                longitude = safe_float(
                    row.get("longitude")
                )
                traffic_score = safe_float(
                    row.get("traffic_activity_score")
                )

                if (
                    latitude is None
                    or longitude is None
                    or traffic_score is None
                ):
                    continue

                traffic_locations.append(
                    {
                        "stopName": (
                            row.get("stop_name")
                            or "Unknown DKV stop"
                        ),
                        "latitude": latitude,
                        "longitude": longitude,
                        "trafficActivityScore": max(
                            0.0,
                            min(100.0, traffic_score),
                        ),
                        "passengerFrequencyTotal": (
                            safe_float(
                                row.get(
                                    "passenger_frequency_total"
                                )
                            )
                            or 0.0
                        ),
                        "passengersInTotal": (
                            safe_float(
                                row.get(
                                    "passengers_in_total"
                                )
                            )
                            or 0.0
                        ),
                        "passengersOutTotal": (
                            safe_float(
                                row.get(
                                    "passengers_out_total"
                                )
                            )
                            or 0.0
                        ),
                    }
                )

    except (OSError, csv.Error) as error:
        print(
            "Warning: Failed to load DKV traffic data:",
            error,
        )
        return tuple()

    return tuple(traffic_locations)


@lru_cache(maxsize=1)
def get_traffic_kdtree() -> tuple[cKDTree | None, tuple[dict[str, Any], ...]]:
    stops = load_traffic_locations()
    if not stops:
        return None, tuple()
    coords = np.array(
        [[float(s["latitude"]), float(s["longitude"])] for s in stops],
        dtype=np.float64,
    )
    xyz = lat_lng_to_cartesian(coords[:, 0], coords[:, 1])
    return cKDTree(xyz), stops


def get_nearby_traffic_stops(
    latitude: float,
    longitude: float,
    *,
    radius_km: float = TRAFFIC_SEARCH_RADIUS_KM,
    limit: int = MAX_NEARBY_TRAFFIC_STOPS,
    prebuilt_traffic: tuple[cKDTree | None, tuple[dict[str, Any], ...]] | None = None,
) -> list[tuple[dict[str, Any], float]]:
    """
    Find DKV stops near a candidate sensor position using spatial cKDTree.
    """
    tree, stops = prebuilt_traffic if prebuilt_traffic is not None else get_traffic_kdtree()
    if tree is None or not stops:
        return []

    query_xyz = lat_lng_to_cartesian(latitude, longitude)[0]
    chord_radius = km_to_chord(radius_km)
    indices = tree.query_ball_point(query_xyz, chord_radius)
    if not indices:
        return []

    nearby_stops: list[tuple[dict[str, Any], float]] = []
    for idx in indices:
        stop = stops[idx]
        dist_chord = float(np.linalg.norm(query_xyz - tree.data[idx]))
        dist_km = float(chord_to_km(dist_chord))
        nearby_stops.append((stop, dist_km))

    nearby_stops.sort(key=lambda item: item[1])
    return nearby_stops[:limit]


def estimate_traffic_influence(
    latitude: float,
    longitude: float,
    prebuilt_traffic: tuple[cKDTree | None, tuple[dict[str, Any], ...]] | None = None,
) -> dict[str, Any]:
    """
    Estimate transport activity around a candidate location.

    Nearby stops are combined through inverse-distance
    weighting. Stops closer to the candidate location
    contribute more strongly.

    The source score is already normalized to 0-100 by
    the DKV preprocessing notebook.
    """

    nearby_stops = get_nearby_traffic_stops(
        latitude,
        longitude,
        prebuilt_traffic=prebuilt_traffic,
    )

    if not nearby_stops:
        return {
            "trafficActivityScore": 0,
            "trafficRisk": 0,
            "trafficConfidence": 0,
            "nearestTrafficStop": None,
            "trafficDistanceKm": None,
            "nearbyTrafficStopCount": 0,
            "nearbyPassengerFrequency": 0,
            "nearbyPassengersIn": 0,
            "nearbyPassengersOut": 0,
        }

    weighted_score_total = 0.0
    weight_total = 0.0
    squared_weight_total = 0.0

    passenger_frequency_total = 0.0
    passengers_in_total = 0.0
    passengers_out_total = 0.0

    for stop, distance in nearby_stops:
        safe_distance = max(
            distance,
            MIN_TRAFFIC_DISTANCE_KM,
        )

        # Inverse-distance weighting.
        weight = 1 / (safe_distance**2)

        weighted_score_total += (
            float(stop["trafficActivityScore"])
            * weight
        )
        weight_total += weight
        squared_weight_total += weight**2

        passenger_frequency_total += float(
            stop["passengerFrequencyTotal"]
        )
        passengers_in_total += float(
            stop["passengersInTotal"]
        )
        passengers_out_total += float(
            stop["passengersOutTotal"]
        )

    traffic_activity_score = (
        weighted_score_total / weight_total
        if weight_total > 0
        else 0.0
    )

    effective_stop_count = (
        (weight_total**2)
        / squared_weight_total
        if squared_weight_total > 0
        else 0.0
    )

    nearest_stop, nearest_distance = (
        nearby_stops[0]
    )

    stop_count_score = min(
        len(nearby_stops)
        / MAX_NEARBY_TRAFFIC_STOPS,
        1.0,
    ) * 100

    effective_count_score = min(
        effective_stop_count / 3,
        1.0,
    ) * 100

    distance_score = (
        100
        - min(
            nearest_distance
            / TRAFFIC_SEARCH_RADIUS_KM,
            1.0,
        )
        * 100
    )

    traffic_confidence = (
        stop_count_score * 0.30
        + effective_count_score * 0.30
        + distance_score * 0.40
    )

    return {
        "trafficActivityScore": round(
            traffic_activity_score
        ),
        "trafficRisk": round(
            traffic_activity_score
        ),
        "trafficConfidence": round(
            max(
                0.0,
                min(
                    100.0,
                    traffic_confidence,
                ),
            )
        ),
        "nearestTrafficStop": nearest_stop[
            "stopName"
        ],
        "trafficDistanceKm": round(
            nearest_distance,
            3,
        ),
        "nearbyTrafficStopCount": len(
            nearby_stops
        ),
        "nearbyPassengerFrequency": round(
            passenger_frequency_total
        ),
        "nearbyPassengersIn": round(
            passengers_in_total
        ),
        "nearbyPassengersOut": round(
            passengers_out_total
        ),
    }


# =========================================================
# GREEN SENTINEL STATION PROCESSING
# =========================================================


def get_air_stations(
    stations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    valid_stations: list[dict[str, Any]] = []

    for station in stations:
        if station.get("station_type") != 0:
            continue

        try:
            latitude = float(station["lat"])
            longitude = float(station["lng"])
        except (
            TypeError,
            ValueError,
            KeyError,
        ):
            continue

        valid_stations.append(
            {
                **station,
                "lat": latitude,
                "lng": longitude,
            }
        )

    return valid_stations


def build_station_kdtree(
    stations: list[dict[str, Any]],
) -> tuple[cKDTree | None, list[dict[str, Any]]]:
    air_stations = get_air_stations(stations)
    if not air_stations:
        return None, []
    coords = np.array(
        [[float(s["lat"]), float(s["lng"])] for s in air_stations],
        dtype=np.float64,
    )
    xyz = lat_lng_to_cartesian(coords[:, 0], coords[:, 1])
    return cKDTree(xyz), air_stations


def get_nearby_stations(
    latitude: float,
    longitude: float,
    stations: list[dict[str, Any]],
    *,
    limit: int = NEAREST_STATION_COUNT,
    prebuilt_tree: tuple[cKDTree | None, list[dict[str, Any]]] | None = None,
) -> list[tuple[dict[str, Any], float]]:
    if prebuilt_tree is not None:
        tree, valid_stations = prebuilt_tree
    else:
        tree, valid_stations = build_station_kdtree(stations)

    if tree is None or not valid_stations:
        return []

    k_to_query = min(limit, len(valid_stations))
    query_xyz = lat_lng_to_cartesian(latitude, longitude)[0]
    chord_dists, indices = tree.query(query_xyz, k=k_to_query)

    if k_to_query == 1:
        chord_dists = [chord_dists]
        indices = [indices]

    nearby: list[tuple[dict[str, Any], float]] = []
    for d_chord, idx in zip(chord_dists, indices):
        if idx < len(valid_stations):
            dist_km = float(chord_to_km(d_chord))
            nearby.append((valid_stations[idx], dist_km))

    return nearby


def find_nearest_station(
    latitude: float,
    longitude: float,
    stations: list[dict[str, Any]],
) -> tuple[
    dict[str, Any] | None,
    float | None,
]:
    nearby = get_nearby_stations(
        latitude,
        longitude,
        stations,
        limit=1,
    )

    if not nearby:
        return None, None

    return nearby[0]


def estimate_weighted_value_from_nearby(
    nearby: list[tuple[dict[str, Any], float]],
    field_name: str,
) -> tuple[float | None, dict[str, float]]:
    weighted_total = 0.0
    weight_total = 0.0
    squared_weight_total = 0.0

    valid_station_count = 0
    nearest_valid_distance: float | None = None

    for station, distance in nearby:
        raw_value = station.get(field_name)

        if raw_value is None:
            continue

        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue

        if distance > MAX_INTERPOLATION_DISTANCE_KM:
            continue

        safe_distance = max(
            distance,
            0.25,
        )

        # Inverse-distance weighting with nearby stations.
        weight = 1 / (safe_distance**2)

        weighted_total += value * weight
        weight_total += weight
        squared_weight_total += weight**2

        valid_station_count += 1

        if nearest_valid_distance is None:
            nearest_valid_distance = distance

    if weight_total == 0:
        return None, {
            "stationCount": 0,
            "nearestDistance": MAX_INTERPOLATION_DISTANCE_KM,
            "effectiveStationCount": 0.0,
        }

    effective_station_count = (
        (weight_total**2) / squared_weight_total
        if squared_weight_total > 0
        else 0.0
    )
    estimated_value = (
        weighted_total / weight_total
    )

    return estimated_value, {
        "stationCount": float(
            valid_station_count
        ),
        "nearestDistance": float(
            nearest_valid_distance
            if nearest_valid_distance is not None
            else MAX_INTERPOLATION_DISTANCE_KM
        ),
        "effectiveStationCount": float(
            effective_station_count
        ),
    }


def get_field_range(
    stations: list[dict[str, Any]],
    field_name: str,
) -> tuple[float, float] | None:
    values: list[float] = []

    for station in stations:
        raw_value = station.get(field_name)

        if raw_value is None:
            continue

        try:
            values.append(float(raw_value))
        except (TypeError, ValueError):
            continue

    if not values:
        return None

    return min(values), max(values)


def calculate_field_risk(
    estimated_value: float | None,
    stations: list[dict[str, Any]],
    field_name: str,
) -> float:
    if estimated_value is None:
        return 0.0

    value_range = get_field_range(
        stations,
        field_name,
    )

    if value_range is None:
        return 0.0

    minimum, maximum = value_range

    return normalize(
        estimated_value,
        minimum,
        maximum,
    )


def calculate_low_wind_risk(
    estimated_wind_speed: float | None,
    stations: list[dict[str, Any]],
) -> float:
    if estimated_wind_speed is None:
        return 0.0

    wind_range = get_field_range(
        stations,
        "windSpeed",
    )

    if wind_range is None:
        return 0.0

    minimum, maximum = wind_range

    return 100 - normalize(
        estimated_wind_speed,
        minimum,
        maximum,
    )


def calculate_measurement_confidence(
    metadata: dict[str, float],
) -> float:
    station_count = metadata["stationCount"]

    effective_station_count = metadata[
        "effectiveStationCount"
    ]

    nearest_distance = metadata[
        "nearestDistance"
    ]

    station_count_score = min(
        station_count
        / NEAREST_STATION_COUNT,
        1.0,
    ) * 100

    effective_count_score = min(
        effective_station_count / 3,
        1.0,
    ) * 100

    distance_score = (
        100
        - min(
            nearest_distance
            / MAX_INTERPOLATION_DISTANCE_KM,
            1.0,
        )
        * 100
    )

    confidence = (
        station_count_score * 0.35
        + effective_count_score * 0.30
        + distance_score * 0.35
    )

    return max(
        0.0,
        min(100.0, confidence),
    )


def estimate_environmental_risk(
    latitude: float,
    longitude: float,
    stations: list[dict[str, Any]],
    prebuilt_air_tree: tuple[cKDTree | None, list[dict[str, Any]]] | None = None,
) -> dict[str, float]:
    air_stations = (
        prebuilt_air_tree[1]
        if prebuilt_air_tree
        else get_air_stations(stations)
    )

    nearby = get_nearby_stations(
        latitude,
        longitude,
        stations,
        prebuilt_tree=prebuilt_air_tree,
    )

    estimated_pm25, pm25_metadata = estimate_weighted_value_from_nearby(
        nearby, "pm25"
    )
    estimated_pm10, pm10_metadata = estimate_weighted_value_from_nearby(
        nearby, "pm10"
    )
    estimated_no2, no2_metadata = estimate_weighted_value_from_nearby(
        nearby, "no2"
    )
    estimated_o3, o3_metadata = estimate_weighted_value_from_nearby(
        nearby, "o3"
    )
    estimated_wind_speed, wind_metadata = estimate_weighted_value_from_nearby(
        nearby, "windSpeed"
    )
    estimated_pm25_std, pm25_std_metadata = estimate_weighted_value_from_nearby(
        nearby, "pm25Std"
    )
    estimated_pm10_std, pm10_std_metadata = estimate_weighted_value_from_nearby(
        nearby, "pm10Std"
    )
    estimated_no2_std, no2_std_metadata = estimate_weighted_value_from_nearby(
        nearby, "no2Std"
    )

    pm25_risk = calculate_field_risk(
        estimated_pm25,
        air_stations,
        "pm25",
    )

    pm10_risk = calculate_field_risk(
        estimated_pm10,
        air_stations,
        "pm10",
    )

    no2_risk = calculate_field_risk(
        estimated_no2,
        air_stations,
        "no2",
    )

    o3_risk = calculate_field_risk(
        estimated_o3,
        air_stations,
        "o3",
    )

    wind_risk = calculate_low_wind_risk(
        estimated_wind_speed,
        air_stations,
    )

    pm25_variability_risk = (
        calculate_field_risk(
            estimated_pm25_std,
            air_stations,
            "pm25Std",
        )
    )

    pm10_variability_risk = (
        calculate_field_risk(
            estimated_pm10_std,
            air_stations,
            "pm10Std",
        )
    )

    no2_variability_risk = (
        calculate_field_risk(
            estimated_no2_std,
            air_stations,
            "no2Std",
        )
    )

    pollution_risk = (
        pm25_risk * 0.35
        + pm10_risk * 0.25
        + no2_risk * 0.25
        + o3_risk * 0.15
    )

    variability_risk = (
        pm25_variability_risk * 0.50
        + pm10_variability_risk * 0.30
        + no2_variability_risk * 0.20
    )

    pollutant_confidences = [
        calculate_measurement_confidence(
            pm25_metadata
        ),
        calculate_measurement_confidence(
            pm10_metadata
        ),
        calculate_measurement_confidence(
            no2_metadata
        ),
        calculate_measurement_confidence(
            o3_metadata
        ),
    ]

    variability_confidences = [
        calculate_measurement_confidence(
            pm25_std_metadata
        ),
        calculate_measurement_confidence(
            pm10_std_metadata
        ),
        calculate_measurement_confidence(
            no2_std_metadata
        ),
    ]

    pollution_confidence = (
        sum(pollutant_confidences)
        / len(pollutant_confidences)
    )

    variability_confidence = (
        sum(variability_confidences)
        / len(variability_confidences)
    )

    wind_confidence = (
        calculate_measurement_confidence(
            wind_metadata
        )
    )

    return {
        "estimatedPm25": round_optional(
            estimated_pm25
        ),
        "estimatedPm10": round_optional(
            estimated_pm10
        ),
        "estimatedNo2": round_optional(
            estimated_no2
        ),
        "estimatedO3": round_optional(
            estimated_o3
        ),
        "estimatedWindSpeed": round_optional(
            estimated_wind_speed
        ),
        "estimatedPm25Std": round_optional(
            estimated_pm25_std
        ),
        "estimatedPm10Std": round_optional(
            estimated_pm10_std
        ),
        "estimatedNo2Std": round_optional(
            estimated_no2_std
        ),
        "pm25Risk": round(pm25_risk),
        "pm10Risk": round(pm10_risk),
        "no2Risk": round(no2_risk),
        "o3Risk": round(o3_risk),
        "pm25VariabilityRisk": round(
            pm25_variability_risk
        ),
        "pm10VariabilityRisk": round(
            pm10_variability_risk
        ),
        "no2VariabilityRisk": round(
            no2_variability_risk
        ),
        "pollutionRisk": round(
            pollution_risk
        ),
        "variabilityRisk": round(
            variability_risk
        ),
        "windRisk": round(wind_risk),
        "pollutionConfidence": round(
            pollution_confidence
        ),
        "variabilityConfidence": round(
            variability_confidence
        ),
        "windConfidence": round(
            wind_confidence
        ),
    }



# =========================================================
# NOISE AND SUBSURFACE-WATER DATA
# =========================================================


def parse_location_coordinates(
    location: str,
) -> tuple[float, float] | None:
    """
    Extract latitude and longitude from location labels such as:
    "ÉNYGÖ, BMW körút (47.577175, 21.502204)".
    """

    match = LOCATION_COORDINATE_PATTERN.search(location)

    if match is None:
        return None

    try:
        latitude = float(match.group(1))
        longitude = float(match.group(2))
    except (TypeError, ValueError):
        return None

    return latitude, longitude


def standard_deviation(
    values: list[float],
) -> float:
    """
    Population standard deviation without adding another dependency.
    """

    if len(values) < 2:
        return 0.0

    mean_value = sum(values) / len(values)

    variance = sum(
        (value - mean_value) ** 2
        for value in values
    ) / len(values)

    return sqrt(variance)


def normalize_from_values(
    value: float,
    reference_values: list[float],
) -> float:
    if not reference_values:
        return 0.0

    return normalize(
        value,
        min(reference_values),
        max(reference_values),
    )


def estimate_point_value(
    latitude: float,
    longitude: float,
    points: tuple[dict[str, Any], ...],
    field_name: str,
    *,
    limit: int = NEAREST_STATION_COUNT,
    maximum_distance_km: float = MAX_INTERPOLATION_DISTANCE_KM,
    prebuilt_tree: cKDTree | None = None,
) -> tuple[float | None, dict[str, float]]:
    """
    Interpolate one field from georeferenced noise or water stations using spatial cKDTree.
    """
    if not points:
        return None, {
            "stationCount": 0.0,
            "nearestDistance": maximum_distance_km,
            "effectiveStationCount": 0.0,
        }

    tree = prebuilt_tree
    if tree is None:
        coords = np.array(
            [[float(p["lat"]), float(p["lng"])] for p in points],
            dtype=np.float64,
        )
        tree = cKDTree(lat_lng_to_cartesian(coords[:, 0], coords[:, 1]))

    query_xyz = lat_lng_to_cartesian(latitude, longitude)[0]

    k_to_query = min(limit, len(points))
    chord_dists, indices = tree.query(query_xyz, k=k_to_query)

    if k_to_query == 1:
        chord_dists = [chord_dists]
        indices = [indices]

    weighted_total = 0.0
    weight_total = 0.0
    squared_weight_total = 0.0
    valid_station_count = 0
    nearest_valid_distance: float | None = None

    for d_chord, idx in zip(chord_dists, indices):
        dist_km = float(chord_to_km(d_chord))
        if dist_km > maximum_distance_km:
            continue

        point = points[idx]
        raw_val = point.get(field_name)
        if raw_val is None:
            continue

        try:
            value = float(raw_val)
        except (TypeError, ValueError):
            continue

        safe_distance = max(dist_km, 0.25)
        weight = 1.0 / (safe_distance**2)

        weighted_total += value * weight
        weight_total += weight
        squared_weight_total += weight**2
        valid_station_count += 1

        if nearest_valid_distance is None:
            nearest_valid_distance = dist_km

    if weight_total == 0:
        return None, {
            "stationCount": 0.0,
            "nearestDistance": maximum_distance_km,
            "effectiveStationCount": 0.0,
        }

    effective_station_count = (
        (weight_total**2) / squared_weight_total
        if squared_weight_total > 0
        else 0.0
    )

    return weighted_total / weight_total, {
        "stationCount": float(valid_station_count),
        "nearestDistance": float(nearest_valid_distance or maximum_distance_km),
        "effectiveStationCount": float(effective_station_count),
    }


def nearest_point_distance(
    latitude: float,
    longitude: float,
    points: tuple[dict[str, Any], ...],
) -> float | None:
    if not points:
        return None

    return min(
        calculate_distance_km(
            latitude,
            longitude,
            float(point["lat"]),
            float(point["lng"]),
        )
        for point in points
    )


@lru_cache(maxsize=1)
def load_noise_stations() -> tuple[dict[str, Any], ...]:
    """
    Load and aggregate the cleaned noise dataset by monitoring location.

    Expected columns:
    timestamp, location, measurement_type, value, unit
    """

    if not NOISE_DATA_PATH.exists():
        print(
            "Warning: Noise dataset was not found at "
            f"{NOISE_DATA_PATH}"
        )
        return tuple()

    grouped: dict[
        str,
        dict[str, list[float]],
    ] = {}

    try:
        with NOISE_DATA_PATH.open(
            mode="r",
            encoding="utf-8-sig",
            newline="",
        ) as csv_file:
            reader = csv.DictReader(csv_file)

            for row in reader:
                location = (row.get("location") or "").strip()
                measurement_type = (
                    row.get("measurement_type") or ""
                ).strip()
                value = safe_float(row.get("value"))

                if (
                    not location
                    or not measurement_type
                    or value is None
                    or value < 0
                ):
                    continue

                grouped.setdefault(location, {}).setdefault(
                    measurement_type,
                    [],
                ).append(value)

    except (OSError, csv.Error) as error:
        print(
            "Warning: Failed to load noise data:",
            error,
        )
        return tuple()

    station_rows: list[dict[str, Any]] = []

    for location, measurements in grouped.items():
        coordinates = parse_location_coordinates(location)

        if coordinates is None:
            continue

        daytime_values = measurements.get(
            "LAEQ nappali",
            [],
        )
        nighttime_values = measurements.get(
            "LAEQ éjszakai",
            [],
        )

        daytime_mean = (
            sum(daytime_values) / len(daytime_values)
            if daytime_values
            else None
        )
        nighttime_mean = (
            sum(nighttime_values) / len(nighttime_values)
            if nighttime_values
            else None
        )

        # Practical 0-100 exposure scales for the demo.
        daytime_risk = (
            normalize(daytime_mean, 45.0, 70.0)
            if daytime_mean is not None
            else 0.0
        )
        nighttime_risk = (
            normalize(nighttime_mean, 40.0, 60.0)
            if nighttime_mean is not None
            else 0.0
        )

        noise_risk = (
            daytime_risk * 0.55
            + nighttime_risk * 0.45
        )

        latitude, longitude = coordinates

        station_rows.append(
            {
                "name": location,
                "lat": latitude,
                "lng": longitude,
                "daytimeNoise": daytime_mean,
                "nighttimeNoise": nighttime_mean,
                "daytimeNoiseStd": standard_deviation(
                    daytime_values
                ),
                "nighttimeNoiseStd": standard_deviation(
                    nighttime_values
                ),
                "noiseRisk": noise_risk,
                "recordCount": (
                    len(daytime_values)
                    + len(nighttime_values)
                ),
            }
        )

    return tuple(station_rows)


@lru_cache(maxsize=1)
def load_water_stations() -> tuple[dict[str, Any], ...]:
    """
    Load and aggregate the cleaned subsurface-water dataset.

    The resulting score is a monitoring-priority indicator, not a
    declaration that the water is polluted.
    """

    if not WATER_DATA_PATH.exists():
        print(
            "Warning: Water dataset was not found at "
            f"{WATER_DATA_PATH}"
        )
        return tuple()

    grouped: dict[
        str,
        dict[str, list[float]],
    ] = {}

    try:
        with WATER_DATA_PATH.open(
            mode="r",
            encoding="utf-8-sig",
            newline="",
        ) as csv_file:
            reader = csv.DictReader(csv_file)

            for row in reader:
                location = (row.get("location") or "").strip()
                measurement_type = (
                    row.get("measurement_type") or ""
                ).strip()
                value = safe_float(row.get("value"))

                if (
                    not location
                    or not measurement_type
                    or value is None
                    or value < 0
                ):
                    continue

                grouped.setdefault(location, {}).setdefault(
                    measurement_type,
                    [],
                ).append(value)

    except (OSError, csv.Error) as error:
        print(
            "Warning: Failed to load water data:",
            error,
        )
        return tuple()

    preliminary: list[dict[str, Any]] = []

    for location, measurements in grouped.items():
        coordinates = parse_location_coordinates(location)

        if coordinates is None:
            continue

        conductivity_values = measurements.get(
            "Conductivity",
            [],
        )
        water_level_values = measurements.get(
            "WaterLevel",
            [],
        )
        water_temp_values = measurements.get(
            "WaterTemp",
            [],
        )

        latitude, longitude = coordinates

        preliminary.append(
            {
                "name": location,
                "lat": latitude,
                "lng": longitude,
                "conductivity": (
                    sum(conductivity_values)
                    / len(conductivity_values)
                    if conductivity_values
                    else None
                ),
                "conductivityStd": standard_deviation(
                    conductivity_values
                ),
                "waterLevel": (
                    sum(water_level_values)
                    / len(water_level_values)
                    if water_level_values
                    else None
                ),
                "waterLevelStd": standard_deviation(
                    water_level_values
                ),
                "waterTemperature": (
                    sum(water_temp_values)
                    / len(water_temp_values)
                    if water_temp_values
                    else None
                ),
                "waterTemperatureStd": standard_deviation(
                    water_temp_values
                ),
                "recordCount": sum(
                    len(values)
                    for values in measurements.values()
                ),
            }
        )

    conductivity_means = [
        float(row["conductivity"])
        for row in preliminary
        if row["conductivity"] is not None
    ]
    conductivity_stds = [
        float(row["conductivityStd"])
        for row in preliminary
    ]
    level_stds = [
        float(row["waterLevelStd"])
        for row in preliminary
    ]
    temperature_stds = [
        float(row["waterTemperatureStd"])
        for row in preliminary
    ]

    stations: list[dict[str, Any]] = []

    for row in preliminary:
        conductivity = safe_float(row["conductivity"])

        conductivity_level_score = (
            normalize_from_values(
                conductivity,
                conductivity_means,
            )
            if conductivity is not None
            else 0.0
        )

        conductivity_variability_score = (
            normalize_from_values(
                float(row["conductivityStd"]),
                conductivity_stds,
            )
        )
        level_variability_score = (
            normalize_from_values(
                float(row["waterLevelStd"]),
                level_stds,
            )
        )
        temperature_variability_score = (
            normalize_from_values(
                float(row["waterTemperatureStd"]),
                temperature_stds,
            )
        )

        water_monitoring_priority = (
            conductivity_level_score * 0.40
            + conductivity_variability_score * 0.25
            + level_variability_score * 0.20
            + temperature_variability_score * 0.15
        )

        stations.append(
            {
                **row,
                "waterMonitoringPriority": (
                    water_monitoring_priority
                ),
            }
        )

    return tuple(stations)


def calculate_coverage_scores(
    grid: list[dict[str, float | int]],
    points: tuple[dict[str, Any], ...] | list[dict[str, Any]],
) -> dict[int, float]:
    """
    Normalize distance-to-nearest-station across the city grid using cKDTree.
    A higher score means a larger monitoring gap.
    """
    if not points or not grid:
        return {}

    coords = np.array(
        [[float(s["lat"]), float(s["lng"])] for s in points],
        dtype=np.float64,
    )
    tree = cKDTree(lat_lng_to_cartesian(coords[:, 0], coords[:, 1]))

    grid_coords = np.array(
        [[float(p["lat"]), float(p["lng"])] for p in grid],
        dtype=np.float64,
    )
    grid_xyz = lat_lng_to_cartesian(grid_coords[:, 0], grid_coords[:, 1])

    chord_dists, _ = tree.query(grid_xyz)
    km_dists = chord_to_km(chord_dists)

    maximum_distance = float(np.max(km_dists)) if len(km_dists) > 0 else 0.0

    if maximum_distance <= 0:
        return {int(p["id"]): 0.0 for p in grid}

    return {
        int(grid[i]["id"]): float(km_dists[i] / maximum_distance * 100.0)
        for i in range(len(grid))
    }


# =========================================================
# DEBRECEN STRATEGIC INFRASTRUCTURE ANCHORS & GROUNDING
# =========================================================

DEBRECEN_STRATEGIC_ANCHORS: list[dict[str, Any]] = [
    {
        "id": 9001,
        "name": "Nagyállomás Intermodal Concourse",
        "lat": 47.5198,
        "lng": 21.6254,
        "category": "transit",
        "categoryLabel": "Transit Intermodal Hub",
        "recommendedTier": "micro",
        "receptorCount": 3,
        "description": "Primary municipal rail and tramway concourse with peak diesel bus idling and commuter NO2 exposure.",
    },
    {
        "id": 9002,
        "name": "Kassai Campus & Primary School Zone",
        "lat": 47.5452,
        "lng": 21.6421,
        "category": "sensitive_receptor",
        "categoryLabel": "Sensitive Receptors & Schools",
        "recommendedTier": "micro",
        "receptorCount": 5,
        "description": "Dense educational corridor hosting university faculties, primary schools, and athletic recreation fields.",
    },
    {
        "id": 9003,
        "name": "Southern Megafactory Buffer (CATL Industrial Park)",
        "lat": 47.4785,
        "lng": 21.6492,
        "category": "industrial",
        "categoryLabel": "Heavy Industry & Megafactory",
        "recommendedTier": "reference",
        "receptorCount": 0,
        "description": "Strategic eastern perimeter of the Southern Industrial Park and battery cell megafactory for statutory dispute defense.",
    },
    {
        "id": 9004,
        "name": "Nagyerdei Clinical Center & Hospital Complex",
        "lat": 47.5582,
        "lng": 21.6278,
        "category": "sensitive_receptor",
        "categoryLabel": "Healthcare & Sensitive Receptors",
        "recommendedTier": "micro",
        "receptorCount": 6,
        "description": "Major regional healthcare hub, pediatric clinics, and emergency medical access thoroughfares.",
    },
    {
        "id": 9005,
        "name": "Segner Tér Transit & Commercial Junction",
        "lat": 47.5312,
        "lng": 21.6145,
        "category": "transit",
        "categoryLabel": "Transit Intermodal Hub",
        "recommendedTier": "micro",
        "receptorCount": 3,
        "description": "High-volume trolleybus and bus interchange along the western inner-ring artery.",
    },
    {
        "id": 9006,
        "name": "BMW Manufacturing Site North-West Perimeter",
        "lat": 47.5721,
        "lng": 21.5645,
        "category": "industrial",
        "categoryLabel": "Heavy Industry & Megafactory",
        "recommendedTier": "reference",
        "receptorCount": 0,
        "description": "Northern industrial expansion corridor capturing logistics freight movements and assembly line emissions.",
    },
    {
        "id": 9007,
        "name": "Tócóskert High-Density Residential Basin",
        "lat": 47.5284,
        "lng": 21.6028,
        "category": "residential_ecological",
        "categoryLabel": "Dense Residential Basin",
        "recommendedTier": "iot",
        "receptorCount": 4,
        "description": "High-density multi-story residential housing blocks with ground-level particulate accumulation during winter inversions.",
    },
    {
        "id": 9008,
        "name": "Újkert Kindergarten & School Complex",
        "lat": 47.5489,
        "lng": 21.6132,
        "category": "sensitive_receptor",
        "categoryLabel": "Sensitive Receptors & Schools",
        "recommendedTier": "iot",
        "receptorCount": 4,
        "description": "Dedicated school pedestrian mall surrounded by multi-family apartment communities.",
    },
    {
        "id": 9009,
        "name": "Kenézy Gyula Teaching Hospital District",
        "lat": 47.5345,
        "lng": 21.6052,
        "category": "sensitive_receptor",
        "categoryLabel": "Healthcare & Sensitive Receptors",
        "recommendedTier": "micro",
        "receptorCount": 3,
        "description": "Western municipal hospital campus and ambulance thoroughfare subject to local road traffic congestion.",
    },
    {
        "id": 9010,
        "name": "Határ Road Logistics & Freight Park",
        "lat": 47.5123,
        "lng": 21.5784,
        "category": "industrial",
        "categoryLabel": "Logistics & Freight Hub",
        "recommendedTier": "iot",
        "receptorCount": 0,
        "description": "Western warehousing and commercial distribution park with elevated heavy vehicle idling emissions.",
    },
    {
        "id": 9011,
        "name": "Nagyerdei Great Forest Ecological Boundary",
        "lat": 47.5512,
        "lng": 21.6345,
        "category": "residential_ecological",
        "categoryLabel": "Ecological & Urban Buffer",
        "recommendedTier": "iot",
        "receptorCount": 1,
        "description": "Ecological boundary assessing natural filtration buffer between urban heat island and protected forest canopy.",
    },
    {
        "id": 9012,
        "name": "Csapókert Suburban Biomass Heating Zone",
        "lat": 47.5385,
        "lng": 21.6582,
        "category": "residential_ecological",
        "categoryLabel": "Suburban Residential Corridor",
        "recommendedTier": "iot",
        "receptorCount": 3,
        "description": "Eastern single-family residential district prone to localized wood and solid-fuel heating smoke in cold seasons.",
    },
    {
        "id": 9013,
        "name": "Debrecen International Airport Flight Path",
        "lat": 47.4912,
        "lng": 21.6156,
        "category": "transit",
        "categoryLabel": "Aviation & Freight Corridor",
        "recommendedTier": "micro",
        "receptorCount": 0,
        "description": "Southern air cargo and passenger flight approach monitoring aviation fuel combustion and runway particulate drift.",
    },
    {
        "id": 9014,
        "name": "Bethlen Gábor Promenade & Historic Center",
        "lat": 47.5328,
        "lng": 21.6231,
        "category": "sensitive_receptor",
        "categoryLabel": "Inner-City Pedestrian Axis",
        "recommendedTier": "iot",
        "receptorCount": 3,
        "description": "Historic pedestrian spine combining dense school pedestrian flows and commercial delivery corridors.",
    },
    {
        "id": 9015,
        "name": "Tócóvölgy Community & Athletic Zone",
        "lat": 47.5361,
        "lng": 21.5975,
        "category": "residential_ecological",
        "categoryLabel": "Community Sports & Recreation",
        "recommendedTier": "iot",
        "receptorCount": 2,
        "description": "Western suburban recreation corridor with neighborhood schools and open-air youth athletic complexes.",
    },
    {
        "id": 9016,
        "name": "Debrecen-Józsa South Ecological Corridor",
        "lat": 47.5950,
        "lng": 21.5780,
        "category": "residential_ecological",
        "categoryLabel": "Northern Ecological Corridor",
        "recommendedTier": "micro",
        "receptorCount": 3,
        "description": "Northern suburban population center and green agricultural buffer protecting Józsa district.",
    },
    {
        "id": 9017,
        "name": "Bánk & Eastern Forest Recreation Basin",
        "lat": 47.4850,
        "lng": 21.7150,
        "category": "residential_ecological",
        "categoryLabel": "Eastern Ecological Buffer",
        "recommendedTier": "iot",
        "receptorCount": 2,
        "description": "South-eastern recreational lake district and residential cluster monitoring biogenic emissions and dust transport.",
    },
    {
        "id": 9018,
        "name": "Nagymacs Western Logistics Gateway",
        "lat": 47.5750,
        "lng": 21.5150,
        "category": "industrial",
        "categoryLabel": "Western Freight & Logistics",
        "recommendedTier": "micro",
        "receptorCount": 2,
        "description": "Western highway junction and logistics perimeter between M35 motorway and industrial assembly plants.",
    },
    {
        "id": 9019,
        "name": "Pallag Academic & Sports Corridor",
        "lat": 47.5850,
        "lng": 21.6700,
        "category": "sensitive_receptor",
        "categoryLabel": "Suburban Youth & Sports Facility",
        "recommendedTier": "iot",
        "receptorCount": 4,
        "description": "North-eastern educational enclave hosting the Debrecen Football Academy and agricultural research campus.",
    },
    {
        "id": 9020,
        "name": "Bayk András Kert & Fancsika Recreation Belt",
        "lat": 47.5180,
        "lng": 21.6980,
        "category": "residential_ecological",
        "categoryLabel": "Eastern Forest Recreation Basin",
        "recommendedTier": "iot",
        "receptorCount": 2,
        "description": "Eastern residential excursion area and green belt capturing regional dust and particulate movements.",
    },
    {
        "id": 9021,
        "name": "Biczó István Kert & Monostorpályi Corridor",
        "lat": 47.4950,
        "lng": 21.6850,
        "category": "residential_ecological",
        "categoryLabel": "South-Eastern Residential Corridor",
        "recommendedTier": "iot",
        "receptorCount": 2,
        "description": "South-eastern residential belt monitoring heating emissions and commuter traffic along Monostorpályi road.",
    },
    {
        "id": 9022,
        "name": "Ondód & Western Motorway Buffer",
        "lat": 47.5250,
        "lng": 21.5450,
        "category": "industrial",
        "categoryLabel": "Western Transport & Industrial Basin",
        "recommendedTier": "micro",
        "receptorCount": 2,
        "description": "Western peripheral basin between M35 motorway corridor, rail freight bypass, and rural residential districts.",
    },
    {
        "id": 9023,
        "name": "Nyulas & Akadémia Residential Green Zone",
        "lat": 47.5620,
        "lng": 21.6050,
        "category": "residential_ecological",
        "categoryLabel": "Northern Residential Green Zone",
        "recommendedTier": "iot",
        "receptorCount": 3,
        "description": "Northern green residential district between Vezér street and the university agricultural campus.",
    },
    {
        "id": 9024,
        "name": "Southern Industrial Park CATL Eastern Buffer",
        "lat": 47.4650,
        "lng": 21.6450,
        "category": "industrial",
        "categoryLabel": "Southern Industrial Expansion Gateway",
        "recommendedTier": "reference",
        "receptorCount": 1,
        "description": "Eastern perimeter of the Southern Industrial Park megafactory corridor providing early baseline warning.",
    },
]


def find_nearest_anchor(lat: float, lng: float) -> dict[str, Any]:
    """Find the closest strategic Debrecen landmark anchor for contextual grounding."""
    best_dist = float("inf")
    best_anchor = DEBRECEN_STRATEGIC_ANCHORS[0]
    for anchor in DEBRECEN_STRATEGIC_ANCHORS:
        d = calculate_distance_km(lat, lng, anchor["lat"], anchor["lng"])
        if d < best_dist:
            best_dist = d
            best_anchor = anchor
    return best_anchor


# =========================================================
# TRAFFIC-AWARE & INFRASTRUCTURE-GROUNDED RECOMMENDATIONS
# =========================================================


def classify_debrecen_sector(lat: float, lng: float) -> str:
    """
    Classify a coordinate into one of Debrecen's 5 municipal planning sectors
    using geometric radial offset from Debrecen city center (47.5316, 21.6273).
    """
    d_lat = (lat - 47.5316) * 111.0
    d_lng = (lng - 21.6273) * 75.0

    if (d_lat**2 + d_lng**2) <= (2.5**2):
        return "center"

    if abs(d_lat) >= abs(d_lng):
        return "north" if d_lat > 0 else "south"
    else:
        return "east" if d_lng > 0 else "west"


def point_to_segment_distance_km(
    lat: float,
    lng: float,
    p1: tuple[float, float],
    p2: tuple[float, float],
) -> float:
    """Distance in km from (lat, lng) to boundary segment (p1 -> p2) where p1, p2 are (lng, lat)."""
    x = (lng - 21.6273) * 74.8
    y = (lat - 47.5316) * 111.1
    x1 = (p1[0] - 21.6273) * 74.8
    y1 = (p1[1] - 47.5316) * 111.1
    x2 = (p2[0] - 21.6273) * 74.8
    y2 = (p2[1] - 47.5316) * 111.1

    dx = x2 - x1
    dy = y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return float(np.hypot(x - x1, y - y1))
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / l2))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return float(np.hypot(x - proj_x, y - proj_y))


def min_dist_to_boundary_km(lat: float, lng: float) -> float:
    """Compute distance from coordinate to the nearest Debrecen municipal polygon boundary."""
    min_d = 999.0
    n = len(DEBRECEN_BOUNDARY_RING)
    for i in range(n):
        p1 = DEBRECEN_BOUNDARY_RING[i]
        p2 = DEBRECEN_BOUNDARY_RING[(i + 1) % n]
        d = point_to_segment_distance_km(lat, lng, p1, p2)
        if d < min_d:
            min_d = d
    return min_d


def generate_recommendations(
    stations: list[dict[str, Any]],
    count: int = 5,
    minimum_distance_km: float = 2.8,
) -> list[dict[str, Any]]:
    """
    Recommend optimal sensor placements using Adjacent Frontier Expansion (MCLP).
    First covers the close adjacent unmonitored spaces directly outside previously installed sensors,
    avoiding sensor radius overlap and progressively expanding outward toward the edge of the city.
    """
    grid = generate_city_grid()
    air_stations = get_air_stations(stations)
    noise_stations = load_noise_stations()
    water_stations = load_water_stations()

    ml_engine.fit_if_needed(air_stations, load_traffic_locations())

    traffic_tree_data = get_traffic_kdtree()

    noise_tree = (
        cKDTree(
            lat_lng_to_cartesian(
                [float(s["lat"]) for s in noise_stations],
                [float(s["lng"]) for s in noise_stations],
            )
        )
        if noise_stations
        else None
    )
    water_tree = (
        cKDTree(
            lat_lng_to_cartesian(
                [float(s["lat"]) for s in water_stations],
                [float(s["lng"]) for s in water_stations],
            )
        )
        if water_stations
        else None
    )

    noise_coverage_scores = calculate_coverage_scores(grid, noise_stations)
    water_coverage_scores = calculate_coverage_scores(grid, water_stations)

    # 1. Vectorized spatial coordinates of municipal grid
    grid_coords = np.array([[float(p["lat"]), float(p["lng"])] for p in grid], dtype=np.float64)
    grid_xyz = lat_lng_to_cartesian(grid_coords[:, 0], grid_coords[:, 1])
    grid_tree = cKDTree(grid_xyz)

    # Precalculate coverage neighborhoods inside Debrecen (standard 2.0 km coverage radius)
    COVERAGE_RADIUS_KM = 2.0
    coverage_chord = km_to_chord(COVERAGE_RADIUS_KM)
    neighbors_per_point = grid_tree.query_ball_tree(grid_tree, r=coverage_chord)

    # Precalculate distance from each grid point to the municipal boundary
    dist_to_bounds = np.array(
        [min_dist_to_boundary_km(c[0], c[1]) for c in grid_coords],
        dtype=np.float64,
    )

    # 2. Compute current Great Circle distance from all active monitoring stations
    # Distinguish core urban stations from distant isolated outposts (like Hármashegy at 16 km)
    urban_air_stations = [
        s for s in air_stations
        if calculate_distance_km(float(s["lat"]), float(s["lng"]), CENTER_LAT, CENTER_LNG) <= 11.0
    ]
    if not urban_air_stations:
        urban_air_stations = air_stations

    if urban_air_stations:
        air_coords = np.array([[float(s["lat"]), float(s["lng"])] for s in urban_air_stations], dtype=np.float64)
        air_xyz = lat_lng_to_cartesian(air_coords[:, 0], air_coords[:, 1])
        air_tree = cKDTree(air_xyz)
        air_tree_data = (air_tree, air_stations)
        chords, _ = air_tree.query(grid_xyz)
        curr_dists = chord_to_km(chords)
    else:
        air_tree_data = None
        curr_dists = np.full(len(grid), 12.0, dtype=np.float64)

    initial_max_distance = float(np.max(curr_dists)) if len(curr_dists) > 0 else 1.0

    # Center coordinates of Debrecen urban agglomeration
    # CENTER_LAT, CENTER_LNG already defined at module level

    # Precalculate spatial relevance vectors to eliminate boundary artifacting
    dist_centers = np.array(
        [calculate_distance_km(c[0], c[1], CENTER_LAT, CENTER_LNG) for c in grid_coords],
        dtype=np.float64,
    )
    nearest_anchors = [find_nearest_anchor(c[0], c[1]) for c in grid_coords]
    dist_anchors = np.array(
        [
            calculate_distance_km(
                grid_coords[i, 0],
                grid_coords[i, 1],
                nearest_anchors[i]["lat"],
                nearest_anchors[i]["lng"],
            )
            for i in range(len(grid))
        ],
        dtype=np.float64,
    )
    receptor_counts = np.array(
        [nearest_anchors[i].get("receptorCount", 1) for i in range(len(grid))],
        dtype=np.float64,
    )
    category_bonuses = np.array(
        [
            1.30
            if nearest_anchors[i].get("category")
            in ["industrial", "transit", "sensitive_receptor"]
            else 1.0
            for i in range(len(grid))
        ],
        dtype=np.float64,
    )

    # Urban agglomeration envelope (Debrecen populated districts & industrial parks are within 8.2 km)
    urban_envelope_weights = np.where(
        dist_centers <= 8.2,
        1.0,
        np.maximum(0.1, np.exp(-0.45 * (dist_centers - 8.2))),
    )
    anchor_weights = np.exp(-((dist_anchors / 3.0) ** 2))
    pop_exposure_weights = (
        (urban_envelope_weights * 0.35 + anchor_weights * 0.25)
        * (1.0 + 0.15 * receptor_counts)
        * category_bonuses
    )

    selected_recommendations: list[dict[str, Any]] = []
    selected_coords: list[tuple[float, float]] = []
    selected_sectors: list[str] = []

    # Maintain dynamic active distances to all current stations
    active_dists = curr_dists.copy()

    # 3. Dynamic Adjacent Frontier Expansion Loop (MCLP)
    # Covers close adjacent spaces first without overlapping the 2.0 km radius, then moves outward toward the edge
    MIN_SEPARATION_FROM_EXISTING = 2.4  # Outside the 2.0 km radius of installed sensors
    MIN_BOUNDARY_DIST = 1.2            # Kept inside the city boundary

    for step in range(1, count + 1):
        # Adaptive thresholds: strict for primary recommendations, progressive relaxation for massive pools
        st_sep = MIN_SEPARATION_FROM_EXISTING if step <= 25 else 2.2
        cand_sep = minimum_distance_km if step <= 25 else (2.4 if step <= 45 else 2.0)
        bound_dist = MIN_BOUNDARY_DIST if step <= 25 else (0.8 if step <= 45 else 0.5)

        scores = np.full(len(grid), -99999.0, dtype=np.float64)

        for i in range(len(grid)):
            d_inst = curr_dists[i]
            # 1. Do NOT overlap with 2.0 km radius of installed monitoring stations
            if d_inst < st_sep:
                continue

            # 2. Do NOT overlap with already selected recommended sensors
            p_lat = float(grid_coords[i, 0])
            p_lng = float(grid_coords[i, 1])
            if any(
                calculate_distance_km(p_lat, p_lng, sc[0], sc[1]) < cand_sep
                for sc in selected_coords
            ):
                continue

            # 3. Prevent placing sensors on the edge of the city (keep 2.0 km circle inside Debrecen)
            if dist_to_bounds[i] < bound_dist:
                continue

            # 4. Frontier Adjacency Preference (Close Adjacent Places First):
            # Prioritizes locations directly adjacent to the previously installed sensors (d_inst <= 4.0 km)
            # and smoothly moves outward to the edge as inner adjacent zones are covered.
            if d_inst <= 4.0:
                adjacency_factor = 1.0 - (d_inst - st_sep) * 0.12
            else:
                adjacency_factor = max(0.1, float(np.exp(-0.50 * (d_inst - 4.0))))

            # 5. Compute true red space eliminated: points currently uncovered (d >= 2.0 km)
            nbrs = neighbors_per_point[i]
            nbr_dists = active_dists[nbrs]
            red_weights = np.clip((nbr_dists - 2.0) / 1.5, 0.0, 1.0)
            red_coverage_gain = float(np.sum(red_weights))

            # 6. Overlap penalty: points inside radius that are ALREADY covered (< 2.0 km)
            overlap_penalty = float(np.sum(nbr_dists < 2.0)) * 1.5

            # 7. Centrality preference: keep sensors within Debrecen urban agglomeration
            dist_center = dist_centers[i]
            centrality_factor = max(0.4, 1.0 - (dist_center / MAX_URBAN_RADIUS_KM) * 0.45)

            # 8. Boundary containment: prefer points where the entire 2.0 km radius is inside city
            boundary_containment = float(np.clip(dist_to_bounds[i] / 2.0, 0.5, 1.0))

            # 9. Sector diversity: distribute top recommendations across South, West, East, North quadrants
            sec = classify_debrecen_sector(p_lat, p_lng)
            cnt = selected_sectors.count(sec)
            sector_factor = 1.0 if cnt == 0 else (0.65 if cnt == 1 else 0.35)

            net_gain = max(0.1, red_coverage_gain - overlap_penalty)
            scores[i] = (
                net_gain * 2.0
                + adjacency_factor * 20.0
                + centrality_factor * 10.0
                + pop_exposure_weights[i] * 1.5
            ) * boundary_containment * sector_factor

        best_idx = int(np.argmax(scores))

        # Controlled relaxation if constraints exhausted candidates before target count reached
        if scores[best_idx] <= -90000.0:
            relaxed_st_sep = max(2.0, st_sep * 0.80)
            relaxed_cand_dist = max(2.0, cand_sep * 0.75)
            relaxed_bound_dist = max(0.6, bound_dist * 0.60)
            for i in range(len(grid)):
                d_inst = curr_dists[i]
                if d_inst < relaxed_st_sep:
                    continue
                p_lat = float(grid_coords[i, 0])
                p_lng = float(grid_coords[i, 1])
                if any(
                    calculate_distance_km(p_lat, p_lng, sc[0], sc[1]) < relaxed_cand_dist
                    for sc in selected_coords
                ):
                    continue
                if dist_to_bounds[i] < relaxed_bound_dist:
                    continue

                nbrs = neighbors_per_point[i]
                nbr_dists = active_dists[nbrs]
                red_weights = np.clip((nbr_dists - 2.0) / 1.5, 0.0, 1.0)
                red_coverage_gain = float(np.sum(red_weights))
                overlap_penalty = float(np.sum(nbr_dists < 2.0)) * 1.5
                boundary_containment = float(np.clip(dist_to_bounds[i] / 2.0, 0.4, 1.0))
                scores[i] = (red_coverage_gain - overlap_penalty) * boundary_containment + pop_exposure_weights[i] * 1.0
            best_idx = int(np.argmax(scores))

        if scores[best_idx] <= -90000.0:
            break

        chosen_lat = float(grid_coords[best_idx, 0])
        chosen_lng = float(grid_coords[best_idx, 1])
        chosen_xyz = grid_xyz[best_idx]
        selected_coords.append((chosen_lat, chosen_lng))
        chosen_sector = classify_debrecen_sector(chosen_lat, chosen_lng)
        selected_sectors.append(chosen_sector)
        best_dist = float(curr_dists[best_idx])

        # Infrastructure Grounding & Landmark Association
        anchor = find_nearest_anchor(chosen_lat, chosen_lng)
        anchor_dist = calculate_distance_km(chosen_lat, chosen_lng, anchor["lat"], anchor["lng"])
        is_anchor_close = anchor_dist < 2.0
        target_name = anchor["name"] if is_anchor_close else f"{anchor['name']} Perimeter"
        category = anchor.get("category", "residential_ecological")
        sector = chosen_sector

        environmental_risk = estimate_environmental_risk(
            chosen_lat,
            chosen_lng,
            air_stations,
            prebuilt_air_tree=air_tree_data,
        )
        traffic_influence = estimate_traffic_influence(
            chosen_lat,
            chosen_lng,
            prebuilt_traffic=traffic_tree_data,
        )
        traffic_score = traffic_influence.get("trafficActivityScore", 25.0)
        receptor_count = anchor.get("receptorCount", 1)

        ml_eval = ml_engine.evaluate_candidate(
            chosen_lat,
            chosen_lng,
            traffic_score,
            receptor_count,
            is_anchor_close,
        )

        estimated_noise_risk, noise_metadata = estimate_point_value(
            chosen_lat, chosen_lng, noise_stations, "noiseRisk", prebuilt_tree=noise_tree,
        )
        estimated_daytime_noise, _ = estimate_point_value(
            chosen_lat, chosen_lng, noise_stations, "daytimeNoise", prebuilt_tree=noise_tree,
        )
        estimated_nighttime_noise, _ = estimate_point_value(
            chosen_lat, chosen_lng, noise_stations, "nighttimeNoise", prebuilt_tree=noise_tree,
        )

        estimated_water_priority, water_metadata = estimate_point_value(
            chosen_lat, chosen_lng, water_stations, "waterMonitoringPriority", prebuilt_tree=water_tree,
        )
        estimated_conductivity, _ = estimate_point_value(
            chosen_lat, chosen_lng, water_stations, "conductivity", prebuilt_tree=water_tree,
        )
        estimated_water_level, _ = estimate_point_value(
            chosen_lat, chosen_lng, water_stations, "waterLevel", prebuilt_tree=water_tree,
        )
        estimated_water_temperature, _ = estimate_point_value(
            chosen_lat, chosen_lng, water_stations, "waterTemperature", prebuilt_tree=water_tree,
        )

        nbrs_chosen = neighbors_per_point[best_idx]
        chosen_red_gain = float(np.sum(np.clip((active_dists[nbrs_chosen] - 2.0) / 1.5, 0.0, 1.0)))
        air_cov_score = min(100.0, 52.0 + (chosen_red_gain / 22.0) * 45.0)
        noise_cov_score = noise_coverage_scores.get(int(grid[best_idx]["id"]), 50.0)
        water_cov_score = water_coverage_scores.get(int(grid[best_idx]["id"]), 50.0)

        air_suitability = (
            air_cov_score * 0.50
            + environmental_risk["pollutionRisk"] * 0.30
            + environmental_risk["variabilityRisk"] * 0.20
        )
        noise_suitability = (
            noise_cov_score * 0.50
            + (estimated_noise_risk or 0.0) * 0.30
            + traffic_influence["trafficRisk"] * 0.20
        )
        water_suitability = (
            water_cov_score * 0.65
            + (estimated_water_priority or 0.0) * 0.35
        )

        # Priority score reflects blind-spot severity, Kriging uncertainty, and information gain
        priority_score = min(98.0, 40.0 + (air_cov_score * 0.40) + (ml_eval["krigingUncertainty"] * 0.20))

        # Hardware Tier Determination
        if category == "industrial" or best_dist >= 11.5:
            rec_tier = "reference"
            rec_sensor_label = "Reference Grade Station (Tier 1)"
        elif category == "transit" or traffic_score >= 45 or best_dist >= 6.5:
            rec_tier = "micro"
            rec_sensor_label = "Mid-Tier Micro-Station (Tier 2)"
        else:
            rec_tier = "iot"
            rec_sensor_label = "Low-Cost IoT Mesh Node (Tier 3)"

        # Find nearest official station name for reporting
        nearest_st_name = "Green Sentinel Station"
        if air_stations:
            nearest_idx = int(np.argmin([calculate_distance_km(chosen_lat, chosen_lng, s["lat"], s["lng"]) for s in air_stations]))
            nearest_st_name = air_stations[nearest_idx].get("name", "Official Station")

        rationale = (
            f"Blind-Spot Priority ({rec_sensor_label}): Resolves a {round(best_dist, 1)}km monitoring void from {nearest_st_name}, "
            f"yielding {round(ml_eval['informationGainScore'])}% ML Information Gain and eliminating {round(ml_eval['krigingUncertainty'])}% Kriging spatial uncertainty."
        )

        selected_recommendations.append(
            {
                "id": 8000 + step,
                "lat": round(chosen_lat, 5),
                "lng": round(chosen_lng, 5),
                "name": f"{target_name} ({round(best_dist, 1)}km blind spot)",
                "targetName": target_name,
                "sector": sector,
                "anchorCategory": category,
                "anchorCategoryLabel": anchor.get("categoryLabel", "Municipal Perimeter"),
                "recommendedHardwareTier": rec_tier,
                "recommendedSensor": rec_sensor_label,
                "recommendationType": "full_station" if rec_tier == "reference" else "air_sensor",
                "nearestStation": nearest_st_name,
                "distanceKm": round(best_dist, 2),
                "priorityScore": round(priority_score),
                "overallConfidence": round(ml_eval["mlConfidence"]),
                "airSuitability": round(air_suitability),
                "noiseSuitability": round(noise_suitability),
                "waterSuitability": round(water_suitability),
                "airCoverageScore": round(air_cov_score),
                "noiseCoverageScore": round(noise_cov_score),
                "waterCoverageScore": round(water_cov_score),
                "trafficActivityScore": round(traffic_score),
                "placementRationale": rationale,
                "receptorsProtected": receptor_count,
                "krigingUncertainty": ml_eval["krigingUncertainty"],
                "informationGainScore": ml_eval["informationGainScore"],
                "surrogateRiskScore": ml_eval["surrogateRiskScore"],
                "mlConfidence": ml_eval["mlConfidence"],
                "mlModelUsed": ml_eval["mlModelUsed"],
                "mlPredictedPm25": ml_eval["mlPredictedPm25"],
                "mlPredictedNo2": ml_eval["mlPredictedNo2"],
                "estimatedPm25": environmental_risk.get("estimatedPm25"),
                "estimatedPm10": environmental_risk.get("estimatedPm10"),
                "estimatedNo2": environmental_risk.get("estimatedNo2"),
                "estimatedO3": environmental_risk.get("estimatedO3"),
                "estimatedDaytimeNoise": round_optional(estimated_daytime_noise),
                "estimatedNighttimeNoise": round_optional(estimated_nighttime_noise),
                "estimatedConductivity": round_optional(estimated_conductivity),
                "estimatedWaterLevel": round_optional(estimated_water_level),
                "estimatedWaterTemperature": round_optional(estimated_water_temperature),
                "primaryMonitoringNeed": (
                    "air"
                    if air_suitability >= noise_suitability and air_suitability >= water_suitability
                    else ("noise" if noise_suitability >= water_suitability else "water")
                ),
                **environmental_risk,
                **traffic_influence,
            }
        )

        # 4. DYNAMIC DISTANCE UPDATE:
        # Collapse distances around the newly placed sensor so no future sensor can cluster near it
        new_chords = np.linalg.norm(grid_xyz - chosen_xyz, axis=1)
        new_km = chord_to_km(new_chords)
        active_dists = np.minimum(active_dists, new_km)
        curr_dists = np.minimum(curr_dists, new_km)

    return selected_recommendations
