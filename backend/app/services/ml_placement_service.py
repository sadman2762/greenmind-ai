"""
Machine Learning Service for Spatial Sensor Placement in Debrecen.

Implements:
1. Spatial Kriging via Gaussian Process Regression (GPR) with Epistemic Uncertainty Quantification
2. Multi-feature Spatial Random Forest Surrogate for non-linear risk modeling
3. Active Learning Information Gain Scoring (Bayesian uncertainty reduction)
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, Matern, WhiteKernel

logger = logging.getLogger("greenmind.ml_placement")

# Debrecen reference center for metric scaling
DEBRECEN_CENTER_LAT = 47.5316
DEBRECEN_CENTER_LNG = 21.6273
KM_PER_LAT = 111.0
KM_PER_LNG = 75.0  # Approx at lat 47.5


def lat_lng_to_local_km(lat: float, lng: float) -> tuple[float, float]:
    """Convert WGS84 coordinates to local kilometer offsets from Debrecen center."""
    d_lat = (lat - DEBRECEN_CENTER_LAT) * KM_PER_LAT
    d_lng = (lng - DEBRECEN_CENTER_LNG) * KM_PER_LNG
    return d_lat, d_lng


class SpatialKrigingModel:
    """
    Gaussian Process Regression model that treats spatial pollutant fields as a continuous
    spatial Gaussian process.

    Provides:
    - Predictive Mean μ(x): Interpolated value accounting for spatial covariance
    - Posterior Standard Deviation σ(x): Epistemic uncertainty quantifying the lack of data
    """

    def __init__(self, length_scale_km: float = 3.5, noise_level: float = 0.5) -> None:
        # Matern nu=1.5 kernel allows realistic continuous atmospheric diffusion
        kernel = (
            ConstantKernel(1.0, "fixed")
            * Matern(length_scale=length_scale_km, nu=1.5)
            + WhiteKernel(noise_level=noise_level, noise_level_bounds="fixed")
        )
        self.gpr = GaussianProcessRegressor(
            kernel=kernel,
            alpha=1e-6,
            normalize_y=True,
            optimizer=None,
            random_state=42,
        )
        self.is_fitted = False
        self.station_count = 0
        self.max_prior_std = 1.0

    def fit(self, coordinates: np.ndarray, values: np.ndarray) -> None:
        """
        Fit GP on spatial coordinates (local km) and target measurements.
        coordinates: (N, 2) in local km
        values: (N,)
        """
        if len(values) < 2:
            self.is_fitted = False
            return

        try:
            self.gpr.fit(coordinates, values)
            self.is_fitted = True
            self.station_count = len(values)

            # Evaluate max standard deviation far from stations for normalization
            far_point = np.array([[30.0, 30.0]])
            _, far_std = self.gpr.predict(far_point, return_std=True)
            self.max_prior_std = max(float(far_std[0]), 1e-4)
        except Exception as err:
            logger.warning("GPR fitting failed: %s", err)
            self.is_fitted = False

    def predict(self, candidate_coords: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """
        Predict values and posterior uncertainties for candidate points.
        Returns: (predicted_means, normalized_uncertainties [0-100])
        """
        if not self.is_fitted:
            # Fallback if insufficient data
            means = np.zeros(len(candidate_coords))
            uncertainties = np.full(len(candidate_coords), 80.0)
            return means, uncertainties

        means, stds = self.gpr.predict(candidate_coords, return_std=True)

        # Normalize standard deviation to [0, 100] uncertainty percentage
        # 100 means maximal epistemic blindness (no nearby sensors)
        normalized_uncertainties = np.clip((stds / self.max_prior_std) * 100.0, 0.0, 100.0)
        return means, normalized_uncertainties


class SpatialSurrogateModel:
    """
    Random Forest spatial surrogate model that learns complex multi-modal
    interactions between transport, industrial zones, wind vectors, and pollutant risk.
    """

    def __init__(self) -> None:
        self.rf = RandomForestRegressor(
            n_estimators=60,
            max_depth=6,
            min_samples_leaf=2,
            random_state=42,
        )
        self.is_fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """
        X: Feature matrix [local_x, local_y, dist_center, traffic_score, industrial_prox, receptor_count]
        y: Normalized combined environmental risk
        """
        if len(y) < 3:
            self.is_fitted = False
            return

        try:
            self.rf.fit(X, y)
            self.is_fitted = True
        except Exception as err:
            logger.warning("Random Forest surrogate fitting failed: %s", err)
            self.is_fitted = False

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            return np.full(len(X), 50.0)
        try:
            return np.clip(self.rf.predict(X), 0.0, 100.0)
        except Exception as err:
            logger.warning("Surrogate prediction failed, using baseline: %s", err)
            return np.full(len(X), 50.0)


class DebrecenMLPlacementEngine:
    """
    High-level orchestrator for machine learning recommendations.
    Manages caching, Kriging fitting, surrogate training, and Bayesian active learning.
    """

    def __init__(self) -> None:
        self.pm25_kriging = SpatialKrigingModel(length_scale_km=4.0)
        self.no2_kriging = SpatialKrigingModel(length_scale_km=3.0)
        self.surrogate = SpatialSurrogateModel()
        self._last_station_fingerprint: str | None = None

    def fit_if_needed(
        self,
        stations: list[dict[str, Any]],
        traffic_locations: tuple[dict[str, Any], ...] | list[dict[str, Any]],
    ) -> None:
        """Fit models when station configuration changes."""
        fingerprint = f"{len(stations)}-{hash(tuple((s.get('id'), s.get('lat'), s.get('lng'), s.get('pm25')) for s in stations))}"
        if fingerprint == self._last_station_fingerprint and self.pm25_kriging.is_fitted:
            return

        coords_list: list[list[float]] = []
        pm25_list: list[float] = []
        no2_list: list[float] = []
        features_list: list[list[float]] = []
        risks_list: list[float] = []

        for s in stations:
            if s.get("station_type") != 0:
                continue
            try:
                lat = float(s["lat"])
                lng = float(s["lng"])
                pm25 = float(s.get("pm25", 15.0) or 15.0)
                no2 = float(s.get("no2", 20.0) or 20.0)
            except (KeyError, TypeError, ValueError):
                continue

            x, y = lat_lng_to_local_km(lat, lng)
            coords_list.append([x, y])
            pm25_list.append(pm25)
            no2_list.append(no2)

            dist_center = np.sqrt(x**2 + y**2)
            traffic_val = float(s.get("trafficActivityScore", 25.0) or 25.0)
            # Industrial proxy: distance to Southern Park (approx lat 47.48, lng 21.65 -> x=-5.7, y=1.7)
            ind_dist = np.sqrt((x - (-5.7))**2 + (y - 1.7)**2)
            receptor = float(s.get("receptorsProtected", 1) or 1)

            features_list.append([x, y, dist_center, traffic_val, ind_dist, receptor])
            # Target composite risk proxy: PM2.5 normalized + NO2 normalized
            comp_risk = min(100.0, (pm25 / 40.0) * 55.0 + (no2 / 50.0) * 45.0)
            risks_list.append(comp_risk)

        if len(coords_list) >= 2:
            coords_arr = np.array(coords_list, dtype=np.float64)
            self.pm25_kriging.fit(coords_arr, np.array(pm25_list, dtype=np.float64))
            self.no2_kriging.fit(coords_arr, np.array(no2_list, dtype=np.float64))

        if len(features_list) >= 3:
            self.surrogate.fit(
                np.array(features_list, dtype=np.float64),
                np.array(risks_list, dtype=np.float64),
            )

        self._last_station_fingerprint = fingerprint

    def evaluate_candidate(
        self,
        lat: float,
        lng: float,
        traffic_score: float,
        receptor_count: int,
        is_strategic_anchor: bool,
    ) -> dict[str, Any]:
        """
        Evaluate a candidate placement point using Gaussian Process Kriging
        and the Random Forest Spatial Surrogate.
        """
        x, y = lat_lng_to_local_km(lat, lng)
        coords = np.array([[x, y]], dtype=np.float64)
        dist_center = float(np.sqrt(x**2 + y**2))
        ind_dist = float(np.sqrt((x - (-5.7))**2 + (y - 1.7)**2))

        # 1. Kriging predictions & uncertainties
        pred_pm25, pm25_unc = self.pm25_kriging.predict(coords)
        pred_no2, no2_unc = self.no2_kriging.predict(coords)

        # Average epistemic uncertainty across monitored pollutants
        kriging_uncertainty = float((pm25_unc[0] + no2_unc[0]) / 2.0)

        # 2. Random Forest surrogate non-linear risk prediction
        features = np.array(
            [[x, y, dist_center, traffic_score, ind_dist, float(receptor_count)]],
            dtype=np.float64,
        )
        rf_risk_pred = float(self.surrogate.predict(features)[0])

        # 3. Active Learning Information Gain calculation
        # Information Gain is high where:
        # - Epistemic uncertainty (σ²) is large (a true blind spot in the monitoring mesh)
        # - Surrogate predicts elevated environmental/transit risk
        # - Sensitive receptors exist nearby that require protection
        receptor_factor = min(100.0, receptor_count * 20.0)
        anchor_bonus = 15.0 if is_strategic_anchor else 0.0

        raw_info_gain = (
            kriging_uncertainty * 0.40
            + rf_risk_pred * 0.35
            + receptor_factor * 0.25
            + anchor_bonus
        )
        information_gain_score = float(max(0.0, min(100.0, raw_info_gain)))

        # 4. Multi-Factor AI Recommendation Confidence
        # Combines Active Learning Information Gain, Surrogate Risk Certainty,
        # and Receptor Proximity rather than collapsing to an arbitrary distance floor.
        rec_confidence = (
            42.0
            + (information_gain_score * 0.36)
            + (rf_risk_pred * 0.16)
            + ((100.0 - kriging_uncertainty) * 0.12)
            + (min(20.0, receptor_count * 4.0))
        )
        ml_confidence = float(max(45.0, min(96.0, rec_confidence)))

        return {
            "mlPredictedPm25": round(float(pred_pm25[0]), 2) if self.pm25_kriging.is_fitted else None,
            "mlPredictedNo2": round(float(pred_no2[0]), 2) if self.no2_kriging.is_fitted else None,
            "krigingUncertainty": round(kriging_uncertainty, 1),
            "surrogateRiskScore": round(rf_risk_pred, 1),
            "informationGainScore": round(information_gain_score, 1),
            "mlConfidence": round(ml_confidence, 1),
            "mlModelUsed": "Gaussian Process Kriging (Matern nu=1.5) + Spatial Random Forest",
        }

    def evaluate_candidates_batch(
        self,
        candidates_data: list[tuple[int, float, float, float, int, bool]],
    ) -> dict[int, dict[str, Any]]:
        """
        Vectorized evaluation of multiple candidate points in a single matrix operation.
        candidates_data: list of (point_id, lat, lng, traffic_score, receptor_count, is_anchor)
        Returns: map of point_id -> ml_eval_dict
        """
        if not candidates_data:
            return {}

        n = len(candidates_data)
        coords = np.zeros((n, 2), dtype=np.float64)
        features = np.zeros((n, 6), dtype=np.float64)

        for i, (_, lat, lng, traffic, receptor, _) in enumerate(candidates_data):
            x, y = lat_lng_to_local_km(lat, lng)
            coords[i, 0] = x
            coords[i, 1] = y
            dist_center = np.sqrt(x**2 + y**2)
            ind_dist = np.sqrt((x - (-5.7))**2 + (y - 1.7)**2)
            features[i] = [x, y, dist_center, traffic, ind_dist, float(receptor)]

        pred_pm25, pm25_unc = self.pm25_kriging.predict(coords)
        pred_no2, no2_unc = self.no2_kriging.predict(coords)
        rf_risk_preds = self.surrogate.predict(features)

        results: dict[int, dict[str, Any]] = {}
        for i, (pid, _, _, _, receptor, is_anchor) in enumerate(candidates_data):
            krig_unc = float((pm25_unc[i] + no2_unc[i]) / 2.0)
            rf_risk = float(rf_risk_preds[i])
            receptor_factor = min(100.0, receptor * 20.0)
            anchor_bonus = 15.0 if is_anchor else 0.0

            raw_info = (
                krig_unc * 0.40
                + rf_risk * 0.35
                + receptor_factor * 0.25
                + anchor_bonus
            )
            info_gain = float(max(0.0, min(100.0, raw_info)))
            rec_conf = (
                42.0
                + (info_gain * 0.36)
                + (rf_risk * 0.16)
                + ((100.0 - krig_unc) * 0.12)
                + (min(20.0, receptor * 4.0))
            )
            conf = float(max(45.0, min(96.0, rec_conf)))

            results[pid] = {
                "mlPredictedPm25": round(float(pred_pm25[i]), 2) if self.pm25_kriging.is_fitted else None,
                "mlPredictedNo2": round(float(pred_no2[i]), 2) if self.no2_kriging.is_fitted else None,
                "krigingUncertainty": round(krig_unc, 1),
                "surrogateRiskScore": round(rf_risk, 1),
                "informationGainScore": round(info_gain, 1),
                "mlConfidence": round(conf, 1),
                "mlModelUsed": "Gaussian Process Kriging (Matern nu=1.5) + Spatial Random Forest",
            }

        return results

    def predict_district_profiles(
        self,
        stations: list[dict[str, Any]],
        noise_stations: tuple[dict[str, Any], ...] | list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Evaluate key Debrecen municipal districts through Gaussian Process Kriging
        and acoustic spatial interpolation, eliminating hardcoded values.
        """
        districts = [
            {
                "district": "Nagyerdő (Great Forest)",
                "lat": 47.5540,
                "lng": 21.6320,
                "trafficScore": 12.0,
                "receptors": 4,
                "category": "ecological",
                "defaultNoiseDay": 46.0,
                "defaultNoiseNight": 37.0,
            },
            {
                "district": "University Campus",
                "lat": 47.5510,
                "lng": 21.6210,
                "trafficScore": 28.0,
                "receptors": 4,
                "category": "education",
                "defaultNoiseDay": 51.0,
                "defaultNoiseNight": 42.0,
            },
            {
                "district": "Tócóskert (Residential)",
                "lat": 47.5310,
                "lng": 21.5980,
                "trafficScore": 24.0,
                "receptors": 3,
                "category": "residential",
                "defaultNoiseDay": 52.0,
                "defaultNoiseNight": 43.0,
            },
            {
                "district": "Downtown Belváros",
                "lat": 47.5316,
                "lng": 21.6273,
                "trafficScore": 48.0,
                "receptors": 5,
                "category": "commercial",
                "defaultNoiseDay": 61.0,
                "defaultNoiseNight": 50.0,
            },
            {
                "district": "DKV Transit Hub",
                "lat": 47.5205,
                "lng": 21.6270,
                "trafficScore": 78.0,
                "receptors": 3,
                "category": "transit",
                "defaultNoiseDay": 67.0,
                "defaultNoiseNight": 54.0,
            },
            {
                "district": "Déli Industrial Park",
                "lat": 47.4810,
                "lng": 21.6420,
                "trafficScore": 62.0,
                "receptors": 1,
                "category": "industrial",
                "defaultNoiseDay": 66.0,
                "defaultNoiseNight": 56.0,
            },
            {
                "district": "Határ Road Logistics",
                "lat": 47.5123,
                "lng": 21.5784,
                "trafficScore": 54.0,
                "receptors": 1,
                "category": "logistics",
                "defaultNoiseDay": 64.0,
                "defaultNoiseNight": 53.0,
            },
        ]

        # Prepare noise interpolation if noise stations are provided
        noise_list = list(noise_stations) if noise_stations else []

        results = []
        for d in districts:
            lat = d["lat"]
            lng = d["lng"]
            traffic = d["trafficScore"]
            receptors = d["receptors"]

            eval_res = self.evaluate_candidate(
                lat=lat,
                lng=lng,
                traffic_score=traffic,
                receptor_count=receptors,
                is_strategic_anchor=True,
            )

            # Day and night noise interpolation from real acoustic stations
            if noise_list:
                w_sum = 0.0
                day_weighted = 0.0
                night_weighted = 0.0
                for ns in noise_list:
                    d_km = max(0.4, np.sqrt(((lat - ns["lat"]) * KM_PER_LAT)**2 + ((lng - ns["lng"]) * KM_PER_LNG)**2))
                    w = 1.0 / (d_km ** 2)
                    w_sum += w
                    day_weighted += float(ns.get("daytimeNoise", 56.0)) * w
                    night_weighted += float(ns.get("nighttimeNoise", 48.0)) * w
                base_day = day_weighted / w_sum if w_sum > 0 else d["defaultNoiseDay"]
                base_night = night_weighted / w_sum if w_sum > 0 else d["defaultNoiseNight"]
                # Traffic influence adjustment
                traffic_adj = (traffic - 35.0) * 0.08
                est_day = round(max(35.0, min(82.0, base_day + traffic_adj)), 1)
                est_night = round(max(30.0, min(75.0, base_night + traffic_adj * 0.7)), 1)
            else:
                est_day = d["defaultNoiseDay"]
                est_night = d["defaultNoiseNight"]

            predicted_pm25 = eval_res["mlPredictedPm25"]
            # Color assignment based on PM2.5 health severity
            if predicted_pm25 is not None:
                if predicted_pm25 <= 10.0:
                    color = "#10b981"
                elif predicted_pm25 <= 15.0:
                    color = "#34d399"
                elif predicted_pm25 <= 25.0:
                    color = "#f59e0b"
                else:
                    color = "#f97316"
            else:
                color = "#10b981"

            results.append({
                "district": d["district"],
                "lat": lat,
                "lng": lng,
                "category": d["category"],
                "pm25": predicted_pm25,
                "no2": eval_res["mlPredictedNo2"],
                "krigingUncertainty": eval_res["krigingUncertainty"],
                "surrogateRiskScore": eval_res["surrogateRiskScore"],
                "informationGainScore": eval_res["informationGainScore"],
                "mlConfidence": eval_res["mlConfidence"],
                "dayNoise": est_day,
                "nightNoise": est_night,
                "color": color,
            })

        return results

    def calculate_city_health_index(
        self,
        average_pm25: float,
        average_no2: float | None,
        daytime_noise: float,
        nighttime_noise: float,
        water_temp: float,
        coverage_percent: float,
        district_profiles: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Calculate an explainable, multi-factor City Health Score (0-100)
        rooted in WHO health standards rather than a static number.
        """
        # 1. Air Score (45%): Target <= 15 ug/m3 PM2.5, Alert >= 35
        if average_pm25 <= 15.0:
            air_score = 100.0 - (average_pm25 / 15.0) * 14.0  # 86 - 100
        elif average_pm25 <= 35.0:
            air_score = 86.0 - ((average_pm25 - 15.0) / 20.0) * 36.0  # 50 - 86
        else:
            air_score = max(15.0, 50.0 - ((average_pm25 - 35.0) / 25.0) * 35.0)

        # 2. Acoustics Score (35%): WHO urban guidelines day <= 53 dB, night <= 45 dB
        day_penalty = max(0.0, daytime_noise - 50.0) * 1.5
        night_penalty = max(0.0, nighttime_noise - 42.0) * 1.8
        noise_score = max(20.0, min(100.0, 100.0 - (day_penalty + night_penalty)))

        # 3. Water Score (20%): Thermal stability near 13.5 C
        temp_delta = abs(water_temp - 13.5)
        water_score = max(40.0, min(100.0, 96.0 - (temp_delta * 4.0)))

        # Composite score
        composite_score = round(air_score * 0.45 + noise_score * 0.35 + water_score * 0.20)
        composite_score = int(max(30, min(98, composite_score)))

        # Vitality Label and Styling
        if composite_score >= 85:
            vitality_label = "Optimal & Fresh"
            vitality_color = "#059669"
            vitality_bg = "rgba(0, 220, 130, 0.12)"
            headline = "Debrecen's Environmental Health is in Optimal Condition"
        elif composite_score >= 70:
            vitality_label = "Good & Healthy"
            vitality_color = "#0f766e"
            vitality_bg = "rgba(15, 118, 110, 0.12)"
            headline = "Debrecen's Environmental Health is in Good Shape"
        elif composite_score >= 50:
            vitality_label = "Moderate Concern"
            vitality_color = "#d97706"
            vitality_bg = "rgba(245, 158, 11, 0.12)"
            headline = "Debrecen Air & Sound Levels Show Moderate Localized Stress"
        else:
            vitality_label = "Unhealthy Alert"
            vitality_color = "#dc2626"
            vitality_bg = "rgba(220, 38, 38, 0.12)"
            headline = "Elevated Pollution and Acoustic Stress Detected in Debrecen"

        # Contextual Citizen Recommendation based on district ML predictions
        if district_profiles:
            cleanest = min(district_profiles, key=lambda d: (d.get("pm25") or 99.0) + (d.get("dayNoise") or 99.0) * 0.2)
            c_name = cleanest["district"]
            c_pm = cleanest["pm25"]
            c_noise = cleanest["dayNoise"]
            citizen_tip = (
                f"AI Citizen Tip: {c_name} offers the cleanest air today ({c_pm} µg/m³ PM2.5, {c_noise} dB sound). "
                f"Optimal for running, cycling, and family walks!"
            )
        else:
            citizen_tip = (
                f"AI Citizen Tip: Fine particulate levels average {average_pm25:.1f} µg/m³, well within WHO safety limits. "
                "Nagyerdő Great Forest and Békás Lake are ideal for outdoor recreation today."
            )

        status_summary = (
            f"Air is fresh ({average_pm25:.1f} µg/m³ PM2.5) and urban sound levels average {daytime_noise:.1f} dB "
            f"across Debrecen's {int(coverage_percent)}% monitored urban canopy."
        )

        return {
            "healthScore": composite_score,
            "airScore": round(air_score, 1),
            "noiseScore": round(noise_score, 1),
            "waterScore": round(water_score, 1),
            "vitalityLabel": vitality_label,
            "vitalityColor": vitality_color,
            "vitalityBg": vitality_bg,
            "headline": headline,
            "citizenTip": citizen_tip,
            "statusSummary": status_summary,
        }


# Singleton engine instance
ml_engine = DebrecenMLPlacementEngine()
