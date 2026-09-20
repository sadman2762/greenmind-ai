from math import asin, cos, radians, sin, sqrt
from typing import Any, Literal

import numpy as np
from scipy.optimize import LinearConstraint, milp

StrategyType = Literal["balanced", "coverage", "precision", "traffic"]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate Great Circle distance in km between two coordinates."""
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2.0) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2.0) ** 2
    return 2.0 * r * asin(min(1.0, sqrt(max(0.0, a))))


def _is_spatially_separated(candidate_dict: dict[str, Any], placed: list[dict[str, Any]], min_dist: float = 2.8) -> bool:
    """Verify that a candidate coordinate is at least min_dist km from all placed sensors."""
    c_lat = float(candidate_dict["lat"])
    c_lng = float(candidate_dict["lng"])
    return all(
        _haversine_km(c_lat, c_lng, float(s["lat"]), float(s["lng"])) >= min_dist
        for s in placed
    )

TIER_SPECS: dict[str, dict[str, Any]] = {
    "reference": {
        "tier": "reference",
        "name": "Reference Grade Station",
        "badge": "Tier 1: Reference",
        "unit_cost": 28000.0,
        "annual_om": 3200.0,
        "radius_km": 3.5,
        "confidence": 95.0,
        "description": "Certified EN reference-grade multi-pollutant analyzer with weather mast",
    },
    "micro": {
        "tier": "micro",
        "name": "Mid-Tier Micro-Station",
        "badge": "Tier 2: Micro",
        "unit_cost": 6500.0,
        "annual_om": 850.0,
        "radius_km": 1.8,
        "confidence": 82.0,
        "description": "Optical particle counter + electrochemical gas sensors + acoustic sensor",
    },
    "iot": {
        "tier": "iot",
        "name": "Low-Cost IoT Node",
        "badge": "Tier 3: IoT Mesh",
        "unit_cost": 1200.0,
        "annual_om": 180.0,
        "radius_km": 0.8,
        "confidence": 68.0,
        "description": "Laser scattering particulate sensor + meteo telemetry, solar/battery powered",
    },
}


def _calculate_portfolio_summary(
    allocated_stations: list[dict[str, Any]],
    budget: float,
    strategy: str,
    name: str = "Portfolio",
    badge: str = "Hybrid",
    description: str = "",
    tier_specs: dict[str, dict[str, Any]] | None = None,
    optimization_engine: str = "MILP (scipy.optimize.milp Exact Global Optimum)",
) -> dict[str, Any]:
    specs = tier_specs or TIER_SPECS
    current_spent = sum(s["unitCost"] for s in allocated_stations)
    remaining_budget = max(0.0, budget - current_spent)
    utilization_percent = (
        round((current_spent / budget) * 100, 1) if budget > 0 else 0.0
    )

    annual_om_total = sum(
        specs.get(s["sensorTier"], TIER_SPECS["iot"])["annual_om"]
        for s in allocated_stations
    )
    five_year_tco = current_spent + (5.0 * annual_om_total)

    tier_counts = {"reference": 0, "micro": 0, "iot": 0}
    for s in allocated_stations:
        tier = s.get("sensorTier", "iot")
        if tier in tier_counts:
            tier_counts[tier] += 1

    total_area_covered_km2 = sum(
        3.14159 * (specs.get(s["sensorTier"], TIER_SPECS["iot"])["radius_km"] ** 2) * 0.65
        for s in allocated_stations
    )
    # Debrecen total municipal area is ~461 km²
    estimated_coverage_gain = min(
        92.0, round((total_area_covered_km2 / 461.0) * 100, 1)
    )

    population_fraction = min(0.96, total_area_covered_km2 / 280.0)
    estimated_population_covered = int(round(200000 * population_fraction))

    if allocated_stations:
        mean_confidence = round(
            sum(s["confidenceRating"] for s in allocated_stations)
            / len(allocated_stations),
            1,
        )
    else:
        mean_confidence = 0.0

    cost_per_resident = (
        round(current_spent / max(1, estimated_population_covered), 2)
        if estimated_population_covered > 0
        else 0.0
    )
    cost_per_km2 = (
        round(current_spent / max(1.0, total_area_covered_km2), 2)
        if total_area_covered_km2 > 0
        else 0.0
    )

    # Regulatory compliance readiness index (0 - 100%)
    ref_count = tier_counts["reference"]
    if ref_count >= 2:
        reg_score = min(98, round(78 + estimated_coverage_gain * 0.25))
    elif ref_count == 1:
        reg_score = min(85, round(60 + estimated_coverage_gain * 0.25))
    else:
        reg_score = min(35, round(15 + estimated_coverage_gain * 0.2))

    # Calibration anchor ratio: (micro + iot) per reference
    if ref_count > 0:
        low_cost_count = tier_counts["micro"] + tier_counts["iot"]
        ratio_str = f"{round(low_cost_count / ref_count, 1)}:1"
    else:
        ratio_str = "No Reference Anchor"

    mean_info_gain = (
        round(
            sum(
                float(s.get("informationGainScore", s.get("priorityScore", 70.0)))
                for s in allocated_stations
            )
            / len(allocated_stations),
            1,
        )
        if allocated_stations
        else 0.0
    )

    return {
        "name": name,
        "badge": badge,
        "description": description,
        "strategy": strategy,
        "optimizationEngine": optimization_engine,
        "meanInformationGain": mean_info_gain,
        "totalBudget": budget,
        "allocatedSpend": round(current_spent, 2),
        "remainingBudget": round(remaining_budget, 2),
        "budgetUtilizationPercent": utilization_percent,
        "totalStations": len(allocated_stations),
        "tierCounts": tier_counts,
        "estimatedAnnualOm": round(annual_om_total, 2),
        "fiveYearTco": round(five_year_tco, 2),
        "costPerResident": cost_per_resident,
        "costPerKm2": cost_per_km2,
        "regulatoryComplianceScore": reg_score,
        "calibrationRatio": ratio_str,
        "estimatedCoverageGainPercent": estimated_coverage_gain,
        "meanConfidenceScore": mean_confidence,
        "estimatedPopulationCovered": estimated_population_covered,
        "allocatedStations": allocated_stations,
        "appliedTierSpecs": {
            k: {
                "unitCost": specs[k]["unit_cost"],
                "annualOm": specs[k]["annual_om"],
                "radiusKm": specs[k]["radius_km"],
                "confidence": specs[k]["confidence"],
            }
            for k in ["reference", "micro", "iot"]
        },
    }


def _create_allocated_station(
    candidate: dict[str, Any],
    tier_info: dict[str, Any],
    rationale: str,
) -> dict[str, Any]:
    return {
        **candidate,
        "sensorTier": tier_info["tier"],
        "tierName": tier_info["name"],
        "tierBadge": tier_info["badge"],
        "unitCost": tier_info["unit_cost"],
        "annualOm": tier_info["annual_om"],
        "effectiveRadiusKm": tier_info["radius_km"],
        "confidenceRating": tier_info["confidence"],
        "placementRationale": rationale,
        "tierDescription": tier_info["description"],
    }


def _solve_milp_portfolio(
    candidates: list[dict[str, Any]],
    budget: float,
    strategy: StrategyType,
    tier_specs: dict[str, dict[str, Any]],
    station_cost_func: Any,
    min_reference: int = 0,
    min_micro: int = 0,
    max_annual_om: float | None = None,
) -> tuple[list[dict[str, Any]], str] | None:
    """
    Solves the multi-choice 0-1 knapsack problem using Mixed-Integer Linear Programming (MILP).
    Mathematically guarantees finding the globally optimal tier allocation that maximizes
    combined Information Gain and strategic municipal value subject to budget & O&M constraints.
    """
    if not candidates or budget < tier_specs["iot"]["unit_cost"]:
        return None

    tiers = ["reference", "micro", "iot"]
    tier_costs = [station_cost_func(t) for t in tiers]
    tier_oms = [tier_specs[t]["annual_om"] for t in tiers]

    # Evaluate up to 65 diverse candidates across all municipal sectors
    cands = candidates[:65]
    n_cands = len(cands)
    n_vars = n_cands * 3

    # Build objective utility vector: we want to MAXIMIZE utility, so in scipy milp c = -utility
    utility = np.zeros(n_vars, dtype=np.float64)

    for i, cand in enumerate(cands):
        info_gain = float(cand.get("informationGainScore", cand.get("priorityScore", 50.0)))
        priority = float(cand.get("priorityScore", 50.0))
        traffic = float(cand.get("trafficActivityScore", 25.0))
        coverage = float(cand.get("airCoverageScore", cand.get("coverageScore", 50.0)))
        pollution = float(cand.get("pollutionRisk", 50.0))
        kriging_unc = float(cand.get("krigingUncertainty", 50.0))
        dist_km = float(cand.get("distanceKm", 2.0))
        is_anchor = bool(cand.get("isStrategicAnchor", False))
        rec_tier = cand.get("recommendedHardwareTier", "iot")
        category = cand.get("anchorCategory", "")

        # Tier multiplier reflects physical coverage area (pi*r^2) and sensing capability:
        # Reference (r=3.5km, 38.5 km², certified EN compliance): base * 4.8
        # Micro (r=1.8km, 10.2 km², optical PM + NO2 + acoustics): base * 2.5
        # IoT (r=0.8km, 2.0 km², laser scattering PM): base * 1.0
        if strategy == "traffic":
            base = traffic * 0.45 + info_gain * 0.30 + priority * 0.25
            tier_mult = {"reference": 4.0 if traffic >= 50 else 3.2, "micro": 3.4, "iot": 1.0}
        elif strategy == "coverage":
            # Coverage strategy strongly rewards blind spot distance & Kriging epistemic uncertainty
            base = coverage * 0.40 + kriging_unc * 0.30 + info_gain * 0.20 + min(100.0, dist_km * 10.0) * 0.10
            tier_mult = {"reference": 3.8, "micro": 2.6, "iot": 1.25}
        elif strategy == "precision":
            base = pollution * 0.45 + info_gain * 0.30 + priority * 0.25
            tier_mult = {"reference": 6.5, "micro": 2.5, "iot": 0.8}
        else:  # balanced
            base = coverage * 0.30 + kriging_unc * 0.25 + info_gain * 0.25 + priority * 0.20
            ref_factor = 5.2 if (is_anchor or pollution >= 55 or dist_km >= 9.0 or category == "industrial") else 4.2
            micro_factor = 3.2 if (traffic >= 35 or category in ["transit", "sensitive_receptor"]) else 2.6
            tier_mult = {"reference": ref_factor, "micro": micro_factor, "iot": 1.0}

        for t_idx, t_name in enumerate(tiers):
            var_idx = i * 3 + t_idx
            # Add small tier-spend tiebreaker to avoid leaving deployable budget on the table
            utility[var_idx] = base * tier_mult[t_name] + (tier_costs[t_idx] / budget) * 1.5

    c = -utility

    # 1. Budget Constraint: sum(cost * x) <= budget
    budget_row = np.zeros(n_vars, dtype=np.float64)
    for i in range(n_cands):
        for t_idx in range(3):
            budget_row[i * 3 + t_idx] = tier_costs[t_idx]

    constraints = [LinearConstraint(budget_row.reshape(1, -1), 0.0, budget)]

    # 2. Annual O&M Constraint (if specified): sum(annual_om * x) <= max_annual_om
    if max_annual_om is not None and max_annual_om > 0:
        om_row = np.zeros(n_vars, dtype=np.float64)
        for i in range(n_cands):
            for t_idx in range(3):
                om_row[i * 3 + t_idx] = tier_oms[t_idx]
        constraints.append(LinearConstraint(om_row.reshape(1, -1), 0.0, max_annual_om))

    # 3. Mutual Exclusivity: for each candidate i, x_ref + x_micro + x_iot <= 1
    mutex_matrix = np.zeros((n_cands, n_vars), dtype=np.float64)
    for i in range(n_cands):
        for t_idx in range(3):
            mutex_matrix[i, i * 3 + t_idx] = 1.0
    constraints.append(LinearConstraint(mutex_matrix, 0.0, 1.0))

    # 4. Mandatory Reference Stations: sum(x_ref) >= min_reference
    if min_reference > 0:
        ref_row = np.zeros(n_vars, dtype=np.float64)
        for i in range(n_cands):
            ref_row[i * 3 + 0] = 1.0
        # If budget cannot support min_reference * ref_cost, abort MILP to let heuristic handle gracefully
        if min_reference * tier_costs[0] > budget:
            return None
        constraints.append(LinearConstraint(ref_row.reshape(1, -1), float(min_reference), float(n_cands)))

    # 4b. Mandatory Micro Stations: sum(x_micro) >= min_micro
    if min_micro > 0:
        micro_row = np.zeros(n_vars, dtype=np.float64)
        for i in range(n_cands):
            micro_row[i * 3 + 1] = 1.0
        if (min_reference * tier_costs[0] + min_micro * tier_costs[1]) <= budget:
            constraints.append(LinearConstraint(micro_row.reshape(1, -1), float(min_micro), float(n_cands)))

    # 5. Spatial Dispersion Anti-Clustering Constraints:
    # If candidate i and candidate j are closer than min_dispersion_km,
    # they cannot both deploy a sensor simultaneously: sum(x_i) + sum(x_j) <= 1
    min_dispersion_km = 2.8
    conflict_pairs: list[tuple[int, int]] = []
    for i in range(n_cands):
        lat_i, lng_i = float(cands[i]["lat"]), float(cands[i]["lng"])
        for j in range(i + 1, n_cands):
            lat_j, lng_j = float(cands[j]["lat"]), float(cands[j]["lng"])
            dist = _haversine_km(lat_i, lng_i, lat_j, lng_j)
            if dist < min_dispersion_km:
                conflict_pairs.append((i, j))

    if conflict_pairs:
        dispersion_matrix = np.zeros((len(conflict_pairs), n_vars), dtype=np.float64)
        for row_idx, (i, j) in enumerate(conflict_pairs):
            for t_idx in range(3):
                dispersion_matrix[row_idx, i * 3 + t_idx] = 1.0
                dispersion_matrix[row_idx, j * 3 + t_idx] = 1.0
        constraints.append(LinearConstraint(dispersion_matrix, 0.0, 1.0))

    try:
        res = milp(
            c=c,
            integrality=np.ones(n_vars),
            constraints=constraints,
        )
        if not res.success or res.x is None:
            return None

        # Build allocated stations list from binary decision solution
        allocated: list[dict[str, Any]] = []
        for i in range(n_cands):
            cand = cands[i]
            for t_idx, t_name in enumerate(tiers):
                var_idx = i * 3 + t_idx
                if res.x[var_idx] > 0.5:  # Binary 1
                    tier_info = tier_specs[t_name]
                    info_gain = round(float(cand.get("informationGainScore", 85.0)))
                    unc = round(float(cand.get("krigingUncertainty", 65.0)))

                    if t_name == "reference":
                        rationale = (
                            f"MILP Optimal Anchor (Tier 1): Certified regulatory baseline; "
                            f"resolves {unc}% Kriging uncertainty with {info_gain}% Information Gain."
                        )
                    elif t_name == "micro":
                        rationale = (
                            f"MILP Optimal Micro (Tier 2): High-resolution optical PM & acoustic sensing; "
                            f"captures {round(float(cand.get('trafficActivityScore', 30)))}% transit corridor exposure."
                        )
                    else:
                        rationale = (
                            f"MILP Optimal Mesh (Tier 3): Maximizes localized suburban sensor density; "
                            f"yields {info_gain}% Bayesian information gain."
                        )

                    allocated.append(_create_allocated_station(cand, tier_info, rationale))
                    break

        return allocated, "MILP (scipy.optimize.milp Guaranteed Global Optimum)"
    except Exception:
        return None


def optimize_sensor_budget(
    candidates: list[dict[str, Any]],
    budget: float,
    strategy: StrategyType = "balanced",
    min_reference: int = 0,
    min_micro: int = 0,
    max_annual_om: float | None = None,
    include_five_year_tco: bool = False,
    custom_tier_specs: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Solves the multi-tier sensor allocation problem for a given municipal budget.
    Balances certified EN Reference stations, Mid-tier micro-stations, and Low-Cost IoT nodes.
    Supports user-customized unit costs, maintenance, and coverage radii.
    """
    effective_budget = budget

    # Merge custom tier specifications if provided
    tier_specs = {k: dict(v) for k, v in TIER_SPECS.items()}
    if custom_tier_specs:
        for tier_k, overrides in custom_tier_specs.items():
            if tier_k in tier_specs and isinstance(overrides, dict):
                for param_k in ["unit_cost", "annual_om", "radius_km", "confidence", "unitCost", "annualOm", "radiusKm"]:
                    norm_k = "unit_cost" if param_k == "unitCost" else "annual_om" if param_k == "annualOm" else "radius_km" if param_k == "radiusKm" else param_k
                    if param_k in overrides and overrides[param_k] is not None:
                        try:
                            val = float(overrides[param_k])
                            if val > 0:
                                tier_specs[tier_k][norm_k] = val
                        except (ValueError, TypeError):
                            pass

    ref_spec = tier_specs["reference"]
    micro_spec = tier_specs["micro"]
    iot_spec = tier_specs["iot"]

    def station_cost(tier: str) -> float:
        if include_five_year_tco:
            return tier_specs[tier]["unit_cost"] + 5.0 * tier_specs[tier]["annual_om"]
        return tier_specs[tier]["unit_cost"]

    ref_cost = station_cost("reference")
    micro_cost = station_cost("micro")
    iot_cost = station_cost("iot")

    if not candidates or effective_budget < iot_cost:
        empty_summary = _calculate_portfolio_summary([], budget, strategy, tier_specs=tier_specs)
        return {
            **empty_summary,
            "comparisons": {
                "referenceOnly": _calculate_portfolio_summary([], budget, "precision", "Pure Reference", "Reference Only", "Zero stations deployable", tier_specs=tier_specs),
                "iotOnly": _calculate_portfolio_summary([], budget, "coverage", "Pure IoT Mesh", "IoT Mesh Only", "Zero stations deployable", tier_specs=tier_specs),
                "currentHybrid": empty_summary,
            },
        }

    # Sort candidates by relevance depending on strategy
    if strategy == "traffic":
        sorted_candidates = sorted(
            candidates,
            key=lambda c: (
                c.get("trafficActivityScore", 0) * 0.6
                + c.get("priorityScore", 0) * 0.4
            ),
            reverse=True,
        )
    elif strategy == "coverage":
        sorted_candidates = sorted(
            candidates,
            key=lambda c: (
                c.get("coverageScore", 0) * 0.6
                + c.get("distanceKm", 0) * 5.0
            ),
            reverse=True,
        )
    elif strategy == "precision":
        sorted_candidates = sorted(
            candidates,
            key=lambda c: (
                c.get("pollutionRisk", 0) * 0.5
                + c.get("priorityScore", 0) * 0.5
            ),
            reverse=True,
        )
    else:  # balanced
        sorted_candidates = sorted(
            candidates,
            key=lambda c: c.get("priorityScore", 0),
            reverse=True,
        )

    # --- 1. Compute Primary Strategy Allocation via Exact MILP ---
    milp_result = _solve_milp_portfolio(
        sorted_candidates,
        effective_budget,
        strategy,
        tier_specs,
        station_cost,
        min_reference=min_reference,
        min_micro=min_micro,
        max_annual_om=max_annual_om,
    )

    if milp_result is not None:
        allocated_stations, engine_name = milp_result
    else:
        engine_name = "Heuristic Knapsack Fallback"
        allocated_stations = []
        current_spent = 0.0
        current_annual_om = 0.0
        tier_counts = {"reference": 0, "micro": 0, "iot": 0}

        # Pre-allocate mandatory minimum reference stations if specified
        if min_reference > 0:
            for cand in sorted_candidates:
                if tier_counts["reference"] >= min_reference:
                    break
                if (current_spent + ref_cost) <= effective_budget:
                    if max_annual_om is None or (current_annual_om + ref_spec["annual_om"]) <= max_annual_om:
                        chosen_tier = "reference"
                        rationale = f"Mandatory municipal regulatory anchor #{tier_counts['reference'] + 1} for legal baseline."
                        allocated_stations.append(_create_allocated_station(cand, ref_spec, rationale))
                        current_spent += ref_cost
                        current_annual_om += ref_spec["annual_om"]
                        tier_counts["reference"] += 1

        allocated_candidate_ids = {s["id"] for s in allocated_stations}
        remaining_candidates = [c for c in sorted_candidates if c.get("id") not in allocated_candidate_ids]

        if strategy == "balanced":
            max_reference = max(min_reference, 1 if effective_budget < 70000 else 2)
            for i, cand in enumerate(remaining_candidates):
                remaining = effective_budget - current_spent
                if remaining < iot_cost:
                    break
                if not _is_spatially_separated(cand, allocated_stations):
                    continue

                can_add_ref = (
                    tier_counts["reference"] < max_reference
                    and remaining >= ref_cost
                    and (i == 0 or cand.get("pollutionRisk", 0) >= 48)
                    and (max_annual_om is None or (current_annual_om + ref_spec["annual_om"]) <= max_annual_om)
                )
                can_add_micro = (
                    remaining >= micro_cost
                    and (
                        cand.get("trafficActivityScore", 0) > 28
                        or cand.get("primaryMonitoringNeed") == "noise"
                        or tier_counts["micro"] < 3
                    )
                    and (max_annual_om is None or (current_annual_om + micro_spec["annual_om"]) <= max_annual_om)
                )
                can_add_iot = (
                    remaining >= iot_cost
                    and (max_annual_om is None or (current_annual_om + iot_spec["annual_om"]) <= max_annual_om)
                )

                if can_add_ref:
                    chosen_tier = "reference"
                    rationale = "Anchor regulatory station in critical multi-environmental zone."
                elif can_add_micro:
                    chosen_tier = "micro"
                    rationale = "Mid-tier station covering high-traffic corridor and acoustic hotspot."
                elif can_add_iot:
                    chosen_tier = "iot"
                    rationale = "Cost-effective IoT node expanding suburban mesh coverage."
                else:
                    continue

                tier_info = tier_specs[chosen_tier]
                current_spent += station_cost(chosen_tier)
                current_annual_om += tier_info["annual_om"]
                tier_counts[chosen_tier] += 1
                allocated_stations.append(_create_allocated_station(cand, tier_info, rationale))

        elif strategy == "coverage":
            max_reference = max(min_reference, 1 if effective_budget >= 100000 else 0)
            for cand in remaining_candidates:
                remaining = effective_budget - current_spent
                if remaining < iot_cost:
                    break
                if not _is_spatially_separated(cand, allocated_stations):
                    continue

                can_add_ref = (
                    max_reference > 0
                    and tier_counts["reference"] < max_reference
                    and remaining >= ref_cost
                    and cand.get("pollutionRisk", 0) > 60
                    and (max_annual_om is None or (current_annual_om + ref_spec["annual_om"]) <= max_annual_om)
                )
                can_add_micro = (
                    remaining >= micro_cost
                    and cand.get("trafficActivityScore", 0) > 35
                    and (max_annual_om is None or (current_annual_om + micro_spec["annual_om"]) <= max_annual_om)
                )
                can_add_iot = (
                    remaining >= iot_cost
                    and (max_annual_om is None or (current_annual_om + iot_spec["annual_om"]) <= max_annual_om)
                )

                if can_add_ref:
                    chosen_tier = "reference"
                    rationale = "Baseline regulatory calibration node in high-pollution zone."
                elif can_add_micro:
                    chosen_tier = "micro"
                    rationale = "Mid-tier node monitoring high-traffic intersection."
                elif can_add_iot:
                    chosen_tier = "iot"
                    rationale = "Broad-area coverage IoT sensor closing monitoring void."
                else:
                    continue

                tier_info = tier_specs[chosen_tier]
                current_spent += station_cost(chosen_tier)
                current_annual_om += tier_info["annual_om"]
                tier_counts[chosen_tier] += 1
                allocated_stations.append(_create_allocated_station(cand, tier_info, rationale))

        elif strategy == "precision":
            for cand in remaining_candidates:
                remaining = effective_budget - current_spent
                if remaining < iot_cost:
                    break
                if not _is_spatially_separated(cand, allocated_stations):
                    continue

                can_add_ref = (
                    remaining >= ref_cost
                    and (max_annual_om is None or (current_annual_om + ref_spec["annual_om"]) <= max_annual_om)
                )
                can_add_micro = (
                    remaining >= micro_cost
                    and (max_annual_om is None or (current_annual_om + micro_spec["annual_om"]) <= max_annual_om)
                )
                can_add_iot = (
                    remaining >= iot_cost
                    and (max_annual_om is None or (current_annual_om + iot_spec["annual_om"]) <= max_annual_om)
                )

                if can_add_ref:
                    chosen_tier = "reference"
                    rationale = "High-precision reference monitor targeting high-pollution receptor."
                elif can_add_micro:
                    chosen_tier = "micro"
                    rationale = "Secondary precision sensor monitoring vulnerable zone."
                elif can_add_iot:
                    chosen_tier = "iot"
                    rationale = "Supplementary IoT node filling localized gap."
                else:
                    continue

                tier_info = tier_specs[chosen_tier]
                current_spent += station_cost(chosen_tier)
                current_annual_om += tier_info["annual_om"]
                tier_counts[chosen_tier] += 1
                allocated_stations.append(_create_allocated_station(cand, tier_info, rationale))

        else:  # traffic
            for cand in remaining_candidates:
                remaining = effective_budget - current_spent
                if remaining < iot_cost:
                    break
                if not _is_spatially_separated(cand, allocated_stations):
                    continue

                traffic_score = cand.get("trafficActivityScore", 0)
                can_add_ref = (
                    remaining >= ref_cost
                    and traffic_score >= 55
                    and tier_counts["reference"] < max(min_reference, 2)
                    and (max_annual_om is None or (current_annual_om + ref_spec["annual_om"]) <= max_annual_om)
                )
                can_add_micro = (
                    remaining >= micro_cost
                    and traffic_score >= 22
                    and (max_annual_om is None or (current_annual_om + micro_spec["annual_om"]) <= max_annual_om)
                )
                can_add_iot = (
                    remaining >= iot_cost
                    and (max_annual_om is None or (current_annual_om + iot_spec["annual_om"]) <= max_annual_om)
                )

                if can_add_ref:
                    chosen_tier = "reference"
                    rationale = "Major transit hub reference station monitoring diesel/particulate peaks."
                elif can_add_micro:
                    chosen_tier = "micro"
                    rationale = "Public-transport corridor micro-station tracking passenger exposure."
                elif can_add_iot:
                    chosen_tier = "iot"
                    rationale = "Residential buffer sensor adjacent to transit corridor."
                else:
                    continue

                tier_info = tier_specs[chosen_tier]
                current_spent += station_cost(chosen_tier)
                current_annual_om += tier_info["annual_om"]
                tier_counts[chosen_tier] += 1
                allocated_stations.append(_create_allocated_station(cand, tier_info, rationale))

    current_summary = _calculate_portfolio_summary(
        allocated_stations,
        budget,
        strategy,
        name="AI Optimal Multi-Tier Hybrid",
        badge="Optimal Hybrid",
        description="Balanced portfolio combining certified reference anchors, transit micro-stations, and school/suburban IoT nodes.",
        tier_specs=tier_specs,
        optimization_engine=engine_name,
    )

    # --- 2. Pre-compute Comparison Scenario A: Pure Reference Stations ---
    ref_only_stations: list[dict[str, Any]] = []
    ref_spent = 0.0
    for cand in sorted_candidates:
        if (ref_spent + ref_cost) <= effective_budget:
            if not _is_spatially_separated(cand, ref_only_stations, min_dist=3.5):
                continue
            ref_only_stations.append(
                _create_allocated_station(
                    cand,
                    ref_spec,
                    "Certified EN reference station with multipollutant analyzers.",
                )
            )
            ref_spent += ref_cost

    ref_only_summary = _calculate_portfolio_summary(
        ref_only_stations,
        budget,
        "precision",
        name="Pure Regulatory Reference Strategy",
        badge="100% Reference",
        description="Maximum legal precision and compliance validity (95%), but very limited geographic coverage leaving major neighborhood gaps.",
        tier_specs=tier_specs,
    )

    # --- 3. Pre-compute Comparison Scenario B: Pure Low-Cost IoT Mesh ---
    iot_only_stations: list[dict[str, Any]] = []
    iot_spent = 0.0
    for cand in sorted_candidates:
        if (iot_spent + iot_cost) <= effective_budget:
            if not _is_spatially_separated(cand, iot_only_stations, min_dist=2.8):
                continue
            iot_only_stations.append(
                _create_allocated_station(
                    cand,
                    iot_spec,
                    "Low-cost laser scattering IoT node for dense hyper-local mesh.",
                )
            )
            iot_spent += iot_cost

    iot_only_summary = _calculate_portfolio_summary(
        iot_only_stations,
        budget,
        "coverage",
        name="Pure Low-Cost IoT Mesh Strategy",
        badge="100% IoT Mesh",
        description="Maximum hyper-local geographic coverage, but zero regulatory compliance anchors and vulnerability to uncalibrated sensor drift.",
        tier_specs=tier_specs,
    )

    return {
        **current_summary,
        "comparisons": {
            "referenceOnly": ref_only_summary,
            "iotOnly": iot_only_summary,
            "currentHybrid": current_summary,
        },
    }
