import React, { useMemo } from "react";
import { CircleMarker } from "react-leaflet";

import { cityGrid } from "../../services/gridService";
import type { Station } from "../../types/station";
import { findNearestAirStation } from "../../utils/nearestStation";

interface CoverageHeatmapProps {
  stations: Station[];
}

function getCoverageColor(score: number): string {
  if (score >= 70) {
    return "#2e7d32";
  }

  if (score >= 40) {
    return "#f9a825";
  }

  return "#d32f2f";
}

function getCoverageOpacity(score: number): number {
  if (score >= 70) {
    return 0.12;
  }

  if (score >= 40) {
    return 0.15;
  }

  return 0.18;
}

const CoverageHeatmap = React.memo(function CoverageHeatmap({
  stations,
}: CoverageHeatmapProps) {
  const heatmapPoints = useMemo(() => {
    const airStations = stations.filter(
      (station) =>
        station.station_type === 0 &&
        Number.isFinite(station.lat) &&
        Number.isFinite(station.lng),
    );

    if (airStations.length === 0) {
      return [];
    }

    // Benchmark distance scale for Green Sentinel physical network coverage:
    // - Full coverage: radius <= 2.0 km (Green, score >= 70, matches 2000m sensor circles)
    // - Interpolated coverage: 2.0 km < radius <= 4.0 km (Yellow, score 40 - 69)
    // - Unmonitored blind spot: radius > 4.0 km (Red, score < 40)
    const REFERENCE_COVERAGE_SCALE_KM = 6.67;

    return cityGrid
      .map((point) => {
        const nearest = findNearestAirStation(
          point.lat,
          point.lng,
          airStations,
        );

        if (nearest.distanceKm === null || !Number.isFinite(nearest.distanceKm)) {
          return null;
        }

        const coverageScore = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              100 -
                (nearest.distanceKm / REFERENCE_COVERAGE_SCALE_KM) * 100,
            ),
          ),
        );

        const color = getCoverageColor(coverageScore);
        const fillOpacity = getCoverageOpacity(coverageScore);

        return {
          id: point.id,
          lat: point.lat,
          lng: point.lng,
          color,
          fillOpacity,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [stations]);

  if (heatmapPoints.length === 0) {
    return null;
  }

  return (
    <>
      {heatmapPoints.map((point) => (
        <CircleMarker
          key={`heat-${point.id}`}
          center={[point.lat, point.lng]}
          radius={8}
          interactive={false}
          pathOptions={{
            color: point.color,
            fillColor: point.color,
            fillOpacity: point.fillOpacity,
            opacity: 0,
            weight: 0,
          }}
        />
      ))}
    </>
  );
});

export default CoverageHeatmap;