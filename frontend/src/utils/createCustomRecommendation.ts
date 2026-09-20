import type { SensorRecommendation } from "../types/recommendation";
import type { Station } from "../types/station";
import { calculateDistanceKm } from "./distance";
import { findNearestAirStation } from "./nearestStation";

export function createCustomRecommendation(
  lat: number,
  lng: number,
  stations: Station[],
  existingId?: number,
): SensorRecommendation {
  const airStations = stations.filter(
    (station) =>
      station.station_type === 0 &&
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lng),
  );

  const nearest = findNearestAirStation(lat, lng, stations);
  const nearestStationName = nearest.station?.name || "Official Monitoring Station";
  const distanceKm = nearest.distanceKm !== null ? nearest.distanceKm : 1.5;

  // Simple Inverse Distance Weighting interpolation for air metrics
  let totalWeight = 0;
  let weightedPm25 = 0;
  let weightedWind = 0;
  let weightedPm10 = 0;
  let weightedNo2 = 0;

  for (const st of airStations) {
    const dist = Math.max(0.2, calculateDistanceKm(lat, lng, st.lat, st.lng));
    const weight = 1 / (dist * dist);
    totalWeight += weight;

    weightedPm25 += (st.pm25 ?? 15.0) * weight;
    weightedWind += (st.windSpeed ?? 5.0) * weight;
    weightedPm10 += (st.pm10 ?? 25.0) * weight;
    weightedNo2 += (st.no2 ?? 18.0) * weight;
  }

  const estimatedPm25 = totalWeight > 0 ? weightedPm25 / totalWeight : (nearest.station?.pm25 ?? 15.0);
  const estimatedWindSpeed = totalWeight > 0 ? weightedWind / totalWeight : (nearest.station?.windSpeed ?? 5.0);
  const estimatedPm10 = totalWeight > 0 ? weightedPm10 / totalWeight : 25.0;
  const estimatedNo2 = totalWeight > 0 ? weightedNo2 / totalWeight : 18.0;

  // Coverage score: 0-100 based on distance (farther away = bigger coverage gap = higher score)
  const coverageScore = Math.min(100, Math.max(10, Math.round((distanceKm / 4.0) * 100)));
  const airCoverageScore = coverageScore;
  const noiseCoverageScore = Math.min(100, Math.max(20, Math.round((distanceKm / 3.0) * 100)));
  const waterCoverageScore = Math.min(100, Math.max(20, Math.round((distanceKm / 5.0) * 100)));

  // Risk scores based on estimated PM2.5
  const pm25Risk = Math.min(100, Math.round((estimatedPm25 / 40.0) * 100));
  const pollutionRisk = pm25Risk;
  const variabilityRisk = Math.min(100, Math.round(pm25Risk * 0.7));
  const windRisk = estimatedWindSpeed < 4 ? 75 : 35;

  // Spatial distance relationships to key emission nodes
  const distToCenter = calculateDistanceKm(lat, lng, 47.5316, 21.6273);
  const distToSouthInd = calculateDistanceKm(lat, lng, 47.4810, 21.6420);

  // Dynamic acoustic estimation based on urban density and industrial proximity
  const urbanDensityFactor = Math.max(0, (5.0 - Math.min(5.0, distToCenter)) / 5.0);
  const industrialFactor = Math.max(0, (6.0 - Math.min(6.0, distToSouthInd)) / 6.0);

  const estimatedDaytimeNoise = Math.round((46.0 + urbanDensityFactor * 16.0 + industrialFactor * 12.0) * 10) / 10;
  const estimatedNighttimeNoise = Math.round((38.0 + urbanDensityFactor * 12.0 + industrialFactor * 8.0) * 10) / 10;
  const noiseRisk = Math.min(100, Math.round(((estimatedDaytimeNoise - 45.0) / 30.0) * 100));

  // Dynamic groundwater depth and temperature based on aquifer basin
  const estimatedWaterTemperature = Math.round((13.2 + (distToCenter * 0.08)) * 10) / 10;
  const estimatedConductivity = Math.round(420 + (urbanDensityFactor * 90) + (industrialFactor * 120));
  const estimatedWaterLevel = Math.round((2.4 + (distToCenter * 0.25)) * 10) / 10;

  // Composite suitability & priority scores
  const airSuitability = Math.round(
    airCoverageScore * 0.45 + pollutionRisk * 0.3 + variabilityRisk * 0.15 + windRisk * 0.1,
  );
  const noiseSuitability = Math.round(noiseCoverageScore * 0.5 + noiseRisk * 0.5);
  const waterSuitability = Math.round(waterCoverageScore * 0.65 + (industrialFactor * 80 + 20) * 0.35);

  const priorityScore = Math.round(
    airSuitability * 0.4 + noiseSuitability * 0.4 + waterSuitability * 0.2,
  );

  // Dynamic confidence derived from spatial distance to existing monitoring poles
  const overallConfidence = Math.max(45, Math.min(95, Math.round(92 - distanceKm * 6.5)));
  const informationGainScore = Math.min(98, Math.round(38 + (distanceKm / 4.5) * 56));
  const krigingUncertainty = Math.min(95, Math.max(15, Math.round(20 + distanceKm * 14)));

  // Dynamic traffic activity based on urban proximity
  const trafficActivityScore = Math.round(18 + urbanDensityFactor * 52 + industrialFactor * 25);

  return {
    id: existingId ?? Date.now(),
    lat,
    lng,
    nearestStation: nearestStationName,
    distanceKm,
    recommendationType: priorityScore >= 75 ? "full_station" : "air_sensor",
    recommendedSensor: priorityScore >= 75 ? "Reference Grade Station (Tier 1)" : "Micro Air Station (Tier 2)",
    primaryMonitoringNeed: airSuitability >= noiseSuitability && airSuitability >= waterSuitability
      ? "air"
      : (noiseSuitability >= waterSuitability ? "noise" : "water"),

    estimatedPm25,
    estimatedPm10,
    estimatedNo2,
    estimatedO3: Math.round((36.0 + (1.0 - urbanDensityFactor) * 12.0) * 10) / 10,
    estimatedWindSpeed,

    estimatedPm25Std: Math.round((estimatedPm25 * 0.22) * 10) / 10,
    estimatedPm10Std: Math.round((estimatedPm10 * 0.24) * 10) / 10,
    estimatedNo2Std: Math.round((estimatedNo2 * 0.20) * 10) / 10,

    estimatedDaytimeNoise,
    estimatedNighttimeNoise,

    estimatedConductivity,
    estimatedWaterLevel,
    estimatedWaterTemperature,

    coverageScore,
    airCoverageScore,
    noiseCoverageScore,
    waterCoverageScore,

    pm25Risk,
    pm10Risk: Math.min(100, Math.round(estimatedPm10 * 1.6)),
    no2Risk: Math.min(100, Math.round(estimatedNo2 * 1.8)),
    o3Risk: Math.round(urbanDensityFactor * 25 + 20),

    pm25VariabilityRisk: variabilityRisk,
    pm10VariabilityRisk: variabilityRisk,
    no2VariabilityRisk: variabilityRisk,

    pollutionRisk,
    variabilityRisk,
    windRisk,
    noiseRisk,
    waterMonitoringPriority: Math.round(waterCoverageScore * 0.7 + industrialFactor * 30),

    airSuitability,
    noiseSuitability,
    waterSuitability,

    priorityScore,

    coverageConfidence: overallConfidence,
    pollutionConfidence: Math.max(50, overallConfidence - 5),
    variabilityConfidence: Math.max(45, overallConfidence - 8),
    windConfidence: Math.max(55, overallConfidence + 3),
    overallConfidence,

    airConfidence: overallConfidence,
    noiseConfidence: Math.max(45, Math.round(overallConfidence * 0.9)),
    waterConfidence: Math.max(45, Math.round(overallConfidence * 0.88)),

    noiseStationCount: 5,
    waterStationCount: 15,

    trafficActivityScore,
    trafficRisk: Math.round(trafficActivityScore * 0.9),
    trafficConfidence: Math.max(50, Math.round(overallConfidence * 0.95)),

    nearestTrafficStop: urbanDensityFactor > 0.5 ? "Central Urban Transit Pole" : "Peripheral Transport Stop",
    trafficDistanceKm: Math.round((0.2 + (1.0 - urbanDensityFactor) * 0.8) * 100) / 100,

    nearbyTrafficStopCount: Math.round(2 + urbanDensityFactor * 6),
    nearbyPassengerFrequency: Math.round(40 + trafficActivityScore * 3.5),
    nearbyPassengersIn: Math.round(20 + trafficActivityScore * 1.75),
    nearbyPassengersOut: Math.round(20 + trafficActivityScore * 1.75),

    informationGainScore,
    krigingUncertainty,
    surrogateRiskScore: pollutionRisk,
    mlConfidence: overallConfidence,
  };
}
