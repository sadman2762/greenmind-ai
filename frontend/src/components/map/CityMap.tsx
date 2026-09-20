import "leaflet/dist/leaflet.css";

import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Snackbar,
  Switch,
  Typography,
} from "@mui/material";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import CloseIcon from "@mui/icons-material/Close";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";

import CoverageHeatmap from "./CoverageHeatmap";
import DebrecenBoundary from "./DebrecenBoundary";
import MapBoundsController from "./MapBoundsController";
import MapLegend from "./MapLegend";
import SimulatedSensorLayer from "./SimulatedSensorLayer";
import CustomPinLayer from "./CustomPinLayer";
import MapClickHandler from "./MapClickHandler";

import { useSimulation } from "../../context/SimulationContext";
import { TIER_CONFIGS, type SensorTier } from "../../types/budget";
import { getStations } from "../../services/stationService";
import {
  getTrafficLocations,
  type TrafficLocation,
} from "../../services/trafficService";
import type { Station } from "../../types/station";

const MIN_VISIBLE_TRAFFIC_SCORE = 10;
const MAX_VISIBLE_TRAFFIC_STOPS = 40;

function getPm25Color(pm25?: number | null): string {
  if (pm25 === undefined || pm25 === null) {
    return "#9e9e9e";
  }

  if (pm25 <= 10) {
    return "#2ecc71";
  }

  if (pm25 <= 20) {
    return "#f1c40f";
  }

  if (pm25 <= 35) {
    return "#e67e22";
  }

  return "#e74c3c";
}

function getTrafficColor(score: number): string {
  if (score >= 50) {
    return "#4527a0";
  }

  if (score >= 25) {
    return "#7e57c2";
  }

  return "#971e22";
}

function getTrafficLevel(score: number): string {
  if (score >= 50) {
    return "Very high";
  }

  if (score >= 25) {
    return "High";
  }

  if (score >= 10) {
    return "Moderate";
  }

  return "Low";
}

function getTrafficMarkerRadius(score: number): number {
  return Math.max(
    4,
    Math.min(11, 4 + score / 12),
  );
}

function cleanLocationName(location?: string | null): string {
  if (!location) return "Debrecen, Hajdú-Bihar";
  // Remove trailing coordinate suffixes like (47.44742297, 21.63063962)
  const cleaned = location.replace(/\s*\([\d.,\s-]+\)$/, "").trim();
  return cleaned || location;
}

function getAirQualityMeta(pm25?: number | null) {
  if (pm25 === undefined || pm25 === null || !Number.isFinite(pm25)) {
    return {
      status: "Telemetry Active",
      badgeColor: "#64748b",
      bgColor: "#f8fafc",
      borderColor: "#e2e8f0",
      description: "Sensor online and reporting live parameters.",
    };
  }
  if (pm25 <= 10) {
    return {
      status: "Good · WHO Target",
      badgeColor: "#15803d",
      bgColor: "#f0fdf4",
      borderColor: "#bbf7d0",
      description: "Air quality complies with WHO annual guideline (≤10 µg/m³).",
    };
  }
  if (pm25 <= 20) {
    return {
      status: "Moderate",
      badgeColor: "#b45309",
      bgColor: "#fffbeb",
      borderColor: "#fde68a",
      description: "Acceptable air quality for healthy individuals.",
    };
  }
  if (pm25 <= 35) {
    return {
      status: "Sensitive Alert",
      badgeColor: "#c2410c",
      bgColor: "#fff7ed",
      borderColor: "#fed7aa",
      description: "Sensitive demographics may experience minor irritation.",
    };
  }
  return {
    status: "Elevated / Warning",
    badgeColor: "#b91c1c",
    bgColor: "#fef2f2",
    borderColor: "#fecaca",
    description: "Concentrations exceed target limits; active monitoring advised.",
  };
}

function degreesToCompass(deg?: number | null): string {
  if (deg === undefined || deg === null || !Number.isFinite(deg)) return "";
  const directions = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
  ];
  const index = Math.round(((deg % 360) / 22.5)) % 16;
  return directions[index];
}

function formatCoValue(co?: number | null): string {
  if (co === undefined || co === null || !Number.isFinite(co)) return "—";
  if (co > 10) {
    return `${(co / 1000).toFixed(2)} mg/m³`;
  }
  return `${co.toFixed(2)} mg/m³`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

interface StationHalosLayerProps {
  effectiveStations: Station[];
  simulatedStationIds: Set<number>;
}

const StationHalosLayer = React.memo(function StationHalosLayer({
  effectiveStations,
  simulatedStationIds,
}: StationHalosLayerProps) {
  return (
    <>
      {effectiveStations
        .filter((station) => station.station_type === 0)
        .map((station) => {
          const isSimulated = simulatedStationIds.has(station.id);
          return (
            <Circle
              key={`coverage-${station.id}`}
              center={[station.lat, station.lng]}
              radius={2000}
              pathOptions={{
                color: isSimulated ? "#8e24aa" : "#2e7d32",
                fillColor: isSimulated ? "#ba68c8" : "#66bb6a",
                fillOpacity: isSimulated ? 0.08 : 0.025,
                opacity: isSimulated ? 0.45 : 0.18,
                weight: isSimulated ? 2 : 1,
                dashArray: isSimulated ? "8 6" : undefined,
              }}
            />
          );
        })}
    </>
  );
});

interface TrafficMarkersLayerProps {
  visibleTrafficLocations: TrafficLocation[];
}

const TrafficMarkersLayer = React.memo(function TrafficMarkersLayer({
  visibleTrafficLocations,
}: TrafficMarkersLayerProps) {
  return (
    <>
      {visibleTrafficLocations.map((location) => {
        const markerColor = getTrafficColor(location.trafficActivityScore);

        return (
          <CircleMarker
            key={`traffic-${location.stopName}-${location.latitude}-${location.longitude}`}
            center={[location.latitude, location.longitude]}
            radius={getTrafficMarkerRadius(location.trafficActivityScore)}
            pathOptions={{
              color: markerColor,
              fillColor: markerColor,
              fillOpacity: 0.45,
              opacity: 0.7,
              weight: 1,
            }}
          >
            <Popup
              minWidth={280}
              maxWidth={320}
              autoPanPaddingTopLeft={[20, 110]}
              autoPanPaddingBottomRight={[20, 20]}
            >
              <Box sx={{ p: 0.5 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}
                    >
                      {location.stopName}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", fontWeight: 500 }}
                    >
                      DKV Public Transit Hub
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={getTrafficLevel(location.trafficActivityScore)}
                    sx={{
                      fontWeight: 800,
                      fontSize: "0.68rem",
                      backgroundColor: `${getTrafficColor(location.trafficActivityScore)}15`,
                      color: getTrafficColor(location.trafficActivityScore),
                      border: `1px solid ${getTrafficColor(location.trafficActivityScore)}40`,
                    }}
                  />
                </Box>

                {/* 2x2 Traffic Metrics Grid */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 0.75,
                    mb: 1.25,
                  }}
                >
                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", fontWeight: 600, display: "block", fontSize: "0.68rem" }}
                    >
                      Activity Index
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 800,
                        color: getTrafficColor(location.trafficActivityScore),
                      }}
                    >
                      {Number(location.trafficActivityScore || 0).toFixed(1)} / 100
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", fontWeight: 600, display: "block", fontSize: "0.68rem" }}
                    >
                      Total Frequency
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 800, color: "#1e293b" }}
                    >
                      {formatNumber(location.passengerFrequencyTotal)}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #dcfce7",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: "#15803d", fontWeight: 600, display: "block", fontSize: "0.68rem" }}
                    >
                      Boarding (In)
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 800, color: "#166534" }}
                    >
                      {formatNumber(location.passengersInTotal)}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: "#b91c1c", fontWeight: 600, display: "block", fontSize: "0.68rem" }}
                    >
                      Alighting (Out)
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 800, color: "#991b1b" }}
                    >
                      {formatNumber(location.passengersOutTotal)}
                    </Typography>
                  </Box>
                </Box>

                {/* Coordinates Footer */}
                <Box
                  sx={{
                    pt: 1,
                    borderTop: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "#64748b" }}>
                    Coordinates
                  </Typography>
                  <Chip
                    size="small"
                    label={`${Number(location.latitude || 0).toFixed(4)}, ${Number(location.longitude || 0).toFixed(4)}`}
                    sx={{
                      height: 18,
                      fontSize: "0.65rem",
                      fontFamily: "monospace",
                      backgroundColor: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                </Box>
              </Box>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
});

interface ImplementedStationsLayerProps {
  stations: Station[];
  onSelectStation: (station: Station) => void;
}

const ImplementedStationsLayer = React.memo(function ImplementedStationsLayer({
  stations,
  onSelectStation,
}: ImplementedStationsLayerProps) {
  return (
    <>
      {stations.map((station) => {
        const markerColor =
          station.station_type === 1
            ? "#1976d2"
            : getPm25Color(station.pm25);

        return (
          <CircleMarker
            key={station.id}
            center={[station.lat, station.lng]}
            radius={9}
            pathOptions={{
              color: markerColor,
              fillColor: markerColor,
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => {
                onSelectStation(station);
              },
            }}
          >
            <Popup
              minWidth={300}
              maxWidth={330}
              autoPan={true}
              autoPanPaddingTopLeft={[24, 48]}
              autoPanPaddingBottomRight={[24, 24]}
              keepInView={true}
              offset={[0, -8]}
            >
              <Box
                sx={{
                  p: 0.15,
                  maxHeight: "min(350px, calc(100vh - 220px))",
                  overflowY: "auto",
                  overflowX: "hidden",
                  pr: 0.3,
                  "&::-webkit-scrollbar": {
                    width: "4px",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    backgroundColor: "#cbd5e1",
                    borderRadius: "4px",
                  },
                }}
              >
                {/* Header */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 800,
                        lineHeight: 1.25,
                        color: "#0f172a",
                        fontSize: "0.88rem",
                      }}
                      noWrap
                    >
                      {cleanLocationName(station.name)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#64748b",
                        fontWeight: 500,
                        display: "block",
                        fontSize: "0.68rem",
                      }}
                    >
                      {station.stationCode ? `#${station.stationCode} · ` : ""}Debrecen Sentinel Node
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={station.station_type === 1 ? "💧 Water" : "🍃 Air"}
                    sx={{
                      height: 20,
                      fontWeight: 800,
                      fontSize: "0.68rem",
                      backgroundColor:
                        station.station_type === 1 ? "#eff6ff" : "#ecfdf5",
                      color:
                        station.station_type === 1 ? "#1d4ed8" : "#047857",
                      border:
                        station.station_type === 1
                          ? "1px solid #bfdbfe"
                          : "1px solid #a7f3d0",
                    }}
                  />
                </Box>

                {/* Air Quality or Surface Water Section */}
                {station.station_type === 1 ? (
                  <Box
                    sx={{
                      p: 0.8,
                      borderRadius: 1.5,
                      backgroundColor: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      mb: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 800, color: "#1e40af", display: "block" }}
                    >
                      💧 Surface Water Telemetry
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#1e3a8a",
                        display: "block",
                        fontSize: "0.68rem",
                        lineHeight: 1.3,
                      }}
                    >
                      Hydrological perimeter station tracking aquifer stability and water run-off.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* Hero Card for PM2.5 */}
                    {(() => {
                      const aq = getAirQualityMeta(station.pm25);
                      return (
                        <Box
                          sx={{
                            p: 0.75,
                            borderRadius: 1.5,
                            backgroundColor: aq.bgColor,
                            border: `1px solid ${aq.borderColor}`,
                            mb: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              mb: 0.2,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 800,
                                color: aq.badgeColor,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                fontSize: "0.65rem",
                              }}
                            >
                              Key Pollutant · PM2.5
                            </Typography>
                            <Chip
                              size="small"
                              label={aq.status}
                              sx={{
                                height: 18,
                                fontSize: "0.62rem",
                                fontWeight: 800,
                                backgroundColor: "#ffffff",
                                color: aq.badgeColor,
                                border: `1px solid ${aq.borderColor}`,
                              }}
                            />
                          </Box>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 900,
                                color: aq.badgeColor,
                                lineHeight: 1,
                                fontSize: "1.15rem",
                              }}
                            >
                              {station.pm25 != null
                                ? Number(station.pm25).toFixed(1)
                                : "—"}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 700, color: "#64748b", fontSize: "0.7rem" }}
                            >
                              µg/m³
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ ml: "auto", color: "#64748b", fontSize: "0.65rem" }}
                            >
                              WHO target: ≤10 µg/m³
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })()}

                    {/* 2x2 Secondary Pollutants Grid */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 0.4,
                        mb: 0.5,
                      }}
                    >
                      <Box
                        sx={{
                          p: 0.5,
                          borderRadius: 1.2,
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#64748b",
                            fontWeight: 700,
                            display: "block",
                            fontSize: "0.64rem",
                          }}
                        >
                          PM10
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, color: "#1e293b", fontSize: "0.78rem" }}
                        >
                          {station.pm10 != null
                            ? `${Number(station.pm10).toFixed(1)} µg/m³`
                            : "—"}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          p: 0.5,
                          borderRadius: 1.2,
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#64748b",
                            fontWeight: 700,
                            display: "block",
                            fontSize: "0.64rem",
                          }}
                        >
                          NO₂ (Nitrogen)
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, color: "#1e293b", fontSize: "0.78rem" }}
                        >
                          {station.no2 != null
                            ? `${Number(station.no2).toFixed(1)} µg/m³`
                            : "—"}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          p: 0.5,
                          borderRadius: 1.2,
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#64748b",
                            fontWeight: 700,
                            display: "block",
                            fontSize: "0.64rem",
                          }}
                        >
                          O₃ (Ozone)
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, color: "#1e293b", fontSize: "0.78rem" }}
                        >
                          {station.o3 != null
                            ? `${Number(station.o3).toFixed(1)} µg/m³`
                            : "—"}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          p: 0.5,
                          borderRadius: 1.2,
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#64748b",
                            fontWeight: 700,
                            display: "block",
                            fontSize: "0.64rem",
                          }}
                        >
                          CO (Carbon Mono.)
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, color: "#1e293b", fontSize: "0.78rem" }}
                        >
                          {formatCoValue(station.co)}
                        </Typography>
                      </Box>
                    </Box>
                  </>
                )}

                {/* Microclimate 3-Column Strip */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 0.4,
                    mb: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      p: 0.4,
                      borderRadius: 1,
                      backgroundColor: "#f1f5f9",
                      textAlign: "center",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#475569",
                        fontWeight: 600,
                        display: "block",
                        fontSize: "0.62rem",
                      }}
                    >
                      💨 Wind
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        color: "#0f172a",
                        fontSize: "0.72rem",
                        display: "block",
                      }}
                    >
                      {station.windSpeed != null
                        ? `${Number(station.windSpeed).toFixed(1)} km/h`
                        : "—"}
                    </Typography>
                    {station.windDirection != null && (
                      <Typography
                        variant="caption"
                        sx={{ color: "#64748b", fontSize: "0.6rem" }}
                      >
                        {degreesToCompass(station.windDirection)} ({Math.round(station.windDirection)}°)
                      </Typography>
                    )}
                  </Box>

                  <Box
                    sx={{
                      p: 0.4,
                      borderRadius: 1,
                      backgroundColor: "#f1f5f9",
                      textAlign: "center",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#475569",
                        fontWeight: 600,
                        display: "block",
                        fontSize: "0.62rem",
                      }}
                    >
                      💧 Humidity
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        color: "#0f172a",
                        fontSize: "0.72rem",
                        display: "block",
                      }}
                    >
                      {station.humidity != null
                        ? `${Number(station.humidity).toFixed(0)}%`
                        : "—"}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", fontSize: "0.6rem" }}
                    >
                      Relative
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 0.4,
                      borderRadius: 1,
                      backgroundColor: "#f1f5f9",
                      textAlign: "center",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#475569",
                        fontWeight: 600,
                        display: "block",
                        fontSize: "0.62rem",
                      }}
                    >
                      ⏱️ Pressure
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        color: "#0f172a",
                        fontSize: "0.72rem",
                        display: "block",
                      }}
                    >
                      {station.pressure != null
                        ? `${Number(station.pressure).toFixed(0)}`
                        : "—"}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", fontSize: "0.6rem" }}
                    >
                      mbar
                    </Typography>
                  </Box>
                </Box>

                {/* Location & GPS Footer */}
                <Box
                  sx={{
                    pt: 0.5,
                    borderTop: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#475569",
                      fontWeight: 600,
                      maxWidth: "60%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "0.68rem",
                    }}
                  >
                    📍 {cleanLocationName(station.location || station.name)}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${Number(station.lat || 0).toFixed(4)}, ${Number(station.lng || 0).toFixed(4)}`}
                    sx={{
                      height: 18,
                      fontSize: "0.62rem",
                      fontFamily: "monospace",
                      backgroundColor: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                </Box>
              </Box>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
});

export default function CityMap() {
  const [stations, setStations] = useState<Station[]>([]);
  const [trafficLocations, setTrafficLocations] = useState<
    TrafficLocation[]
  >([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showStations, setShowStations] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showCoverageCircles, setShowCoverageCircles] =
    useState(false);
  const {
    simulatedStations,
    isPlacingCustomPin,
    setIsPlacingCustomPin,
    customPinTier,
    setCustomPinTier,
  } = useSimulation();

  const [notification, setNotification] = useState<{
    message: string;
    severity: "success" | "warning" | "info";
  } | null>(null);

  useEffect(() => {
    async function loadMapData() {
      setLoading(true);
      setError("");

      try {
        const [stationData, trafficData] =
          await Promise.all([
            getStations(),
            getTrafficLocations(),
          ]);

        setStations(stationData);
        setTrafficLocations(trafficData);
      } catch {
        setError(
          "Could not load Green Sentinel or DKV transport data.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadMapData();
  }, []);

  const effectiveStations = useMemo(
    () => [...stations, ...simulatedStations],
    [stations, simulatedStations],
  );

  const simulatedStationIds = useMemo(
    () => new Set(simulatedStations.map((s) => s.id)),
    [simulatedStations],
  );

  const handleSelectStation = useCallback((station: Station) => {
    startTransition(() => {
      setSelectedStation((prev) => (prev?.id === station.id ? prev : station));
    });
  }, []);

  const visibleTrafficLocations = useMemo(
    () =>
      trafficLocations
        .filter(
          (location) =>
            Number.isFinite(location.latitude) &&
            Number.isFinite(location.longitude) &&
            Number.isFinite(
              location.trafficActivityScore,
            ) &&
            location.trafficActivityScore >=
            MIN_VISIBLE_TRAFFIC_SCORE,
        )
        .sort(
          (first, second) =>
            second.trafficActivityScore -
            first.trafficActivityScore,
        )
        .slice(0, MAX_VISIBLE_TRAFFIC_STOPS),
    [trafficLocations],
  );

  const activeTierConfig = TIER_CONFIGS[customPinTier] || TIER_CONFIGS.iot;

  if (loading) {
    return (
      <Card
        sx={{
          mt: 4,
          height: 560,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Card>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Card
      elevation={2}
      sx={{
        mt: 4,
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid #e2e8f0",
      }}
    >
      {/* 1. Unified Map Control Toolbar (Placed cleanly ABOVE the map to prevent ANY overlap) */}
      <Box
        sx={{
          p: 2,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        {/* Left: Branding & Custom Pin Placer */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Box>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 800, color: "#0f172a", lineHeight: 1.2, fontSize: "1rem" }}
            >
              🌿 Debrecen Spatial Digital Twin
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500 }}>
              18 Sentinel Stations · Real-Time Telemetry & Kriging Analysis
            </Typography>
          </Box>

          <Button
            variant={isPlacingCustomPin ? "contained" : "outlined"}
            size="small"
            startIcon={
              isPlacingCustomPin ? (
                <TouchAppIcon />
              ) : (
                <AddLocationAltIcon />
              )
            }
            onClick={() => setIsPlacingCustomPin((prev) => !prev)}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.78rem",
              backgroundColor: isPlacingCustomPin ? activeTierConfig.color : undefined,
              borderColor: activeTierConfig.color,
              color: isPlacingCustomPin ? "#ffffff" : activeTierConfig.color,
              "&:hover": {
                backgroundColor: isPlacingCustomPin ? activeTierConfig.color : `${activeTierConfig.color}15`,
                borderColor: activeTierConfig.color,
              },
            }}
          >
            {isPlacingCustomPin ? "Exit Pin Mode" : "Place Custom Sensor"}
          </Button>

          {/* Tier Selector Chips */}
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {(["reference", "micro", "iot"] as SensorTier[]).map((tierKey) => {
              const conf = TIER_CONFIGS[tierKey];
              const isSelected = customPinTier === tierKey;
              return (
                <Chip
                  key={tierKey}
                  size="small"
                  clickable
                  label={
                    tierKey === "reference"
                      ? "🏛️ Ref (€28k)"
                      : tierKey === "micro"
                        ? "📡 Micro (€6.5k)"
                        : "📶 IoT (€1.2k)"
                  }
                  onClick={() => {
                    setCustomPinTier(tierKey);
                    if (!isPlacingCustomPin) {
                      setIsPlacingCustomPin(true);
                    }
                  }}
                  sx={{
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: "0.72rem",
                    backgroundColor: isSelected ? conf.bgColor : "#f8fafc",
                    color: isSelected ? conf.color : "#475569",
                    border: isSelected
                      ? `2px solid ${conf.borderColor}`
                      : "1px solid #e2e8f0",
                    "&:hover": {
                      backgroundColor: conf.bgColor,
                      borderColor: conf.borderColor,
                    },
                  }}
                />
              );
            })}
          </Box>
        </Box>

        {/* Right: Map Layers Toggles */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            backgroundColor: "#f8fafc",
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            border: "1px solid #e2e8f0",
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, color: "#64748b", textTransform: "uppercase", fontSize: "0.68rem" }}
          >
            Layers:
          </Typography>

          <FormControlLabel
            sx={{ m: 0, mr: 0.5 }}
            control={
              <Switch
                size="small"
                checked={showStations}
                onChange={(e) => setShowStations(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#334155", fontSize: "0.75rem" }}>
                Stations
              </Typography>
            }
          />

          <FormControlLabel
            sx={{ m: 0, mr: 0.5 }}
            control={
              <Switch
                size="small"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#334155", fontSize: "0.75rem" }}>
                Heatmap
              </Typography>
            }
          />

          <FormControlLabel
            sx={{ m: 0, mr: 0.5 }}
            control={
              <Switch
                size="small"
                checked={showTraffic}
                onChange={(e) => setShowTraffic(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#334155", fontSize: "0.75rem" }}>
                DKV Transit
              </Typography>
            }
          />

          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Switch
                size="small"
                checked={showCoverageCircles}
                onChange={(e) => setShowCoverageCircles(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#334155", fontSize: "0.75rem" }}>
                Radius
              </Typography>
            }
          />
        </Box>
      </Box>

      {/* Pin Mode Helper Banner */}
      {isPlacingCustomPin && (
        <Box
          sx={{
            px: 2,
            py: 1,
            backgroundColor: activeTierConfig.bgColor,
            borderBottom: `1px solid ${activeTierConfig.borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              size="small"
              label={activeTierConfig.badge}
              sx={{
                backgroundColor: activeTierConfig.color,
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "0.7rem",
                height: 20,
              }}
            />
            <Typography variant="caption" sx={{ color: "#334155", fontWeight: 600 }}>
              Click anywhere within the Debrecen boundary to place a <strong>{activeTierConfig.name}</strong> ({activeTierConfig.radiusKm} km halo, €{activeTierConfig.unitCost.toLocaleString()}). Drag marker anytime to reposition!
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => setIsPlacingCustomPin(false)}
            sx={{ fontSize: "0.72rem", textTransform: "none", fontWeight: 700, color: activeTierConfig.color }}
          >
            Cancel
          </Button>
        </Box>
      )}

      {/* 2. Map Container with 100% Unobstructed Surface */}
      <Box
        sx={{
          position: "relative",
          "& .leaflet-popup-content": {
            margin: "10px 12px !important",
            lineHeight: 1.3,
          },
          "& .leaflet-popup-content-wrapper": {
            borderRadius: "14px !important",
            boxShadow:
              "0 12px 28px -4px rgba(15, 23, 42, 0.18), 0 4px 12px -2px rgba(15, 23, 42, 0.08) !important",
            padding: "2px !important",
          },
          "& .leaflet-container a.leaflet-popup-close-button": {
            top: "8px !important",
            right: "8px !important",
            color: "#94a3b8 !important",
            fontSize: "16px !important",
            padding: "2px !important",
            "&:hover": {
              color: "#334155 !important",
            },
          },
        }}
      >

        <MapContainer
          center={[47.5316, 21.6273]}
          zoom={10}
          minZoom={9}
          maxZoom={16}
          scrollWheelZoom
          preferCanvas={true}
          style={{
            height: "clamp(640px, 68vh, 760px)",
            width: "100%",
          }}
        >
          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <DebrecenBoundary />

          <MapBoundsController />

          {showHeatmap && (
            <CoverageHeatmap
              stations={effectiveStations}
            />
          )}

          {showCoverageCircles && (
            <StationHalosLayer
              effectiveStations={effectiveStations}
              simulatedStationIds={simulatedStationIds}
            />
          )}

          {showTraffic && (
            <TrafficMarkersLayer
              visibleTrafficLocations={visibleTrafficLocations}
            />
          )}

          {showStations && (
            <ImplementedStationsLayer
              stations={stations}
              onSelectStation={handleSelectStation}
            />
          )}

          <SimulatedSensorLayer stations={stations} />
          <CustomPinLayer stations={stations} />

          <MapClickHandler
            stations={stations}
            onInvalidLocation={() =>
              setNotification({
                message:
                  "Selected coordinate is outside Debrecen municipal boundary.",
                severity: "warning",
              })
            }
            onPinAdded={(_lat, _lng, placedTier) => {
              const conf = TIER_CONFIGS[placedTier] || TIER_CONFIGS.iot;
              setNotification({
                message: `Virtual ${conf.name} (${conf.badge}) placed! Drag marker anywhere to test coverage.`,
                severity: "success",
              });
            }}
          />
        </MapContainer>

        <MapLegend />
      </Box>

      {/* 3. Selected Station Deep Telemetry Inspector Dock */}
      {selectedStation && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            backgroundColor: "#f8fafc",
            borderTop: "2px solid #e2e8f0",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
                Active Station Telemetry: {cleanLocationName(selectedStation.name)}
              </Typography>
              <Chip
                size="small"
                label={
                  selectedStation.station_type === 1
                    ? "💧 Surface Water Node"
                    : "🍃 Air Quality Station"
                }
                sx={{
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  backgroundColor:
                    selectedStation.station_type === 1 ? "#eff6ff" : "#ecfdf5",
                  color:
                    selectedStation.station_type === 1 ? "#1d4ed8" : "#047857",
                  border:
                    selectedStation.station_type === 1
                      ? "1px solid #bfdbfe"
                      : "1px solid #a7f3d0",
                }}
              />
              {selectedStation.stationCode && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`#${selectedStation.stationCode}`}
                  sx={{ fontSize: "0.72rem", fontWeight: 700 }}
                />
              )}
            </Box>

            <Button
              size="small"
              startIcon={<CloseIcon />}
              onClick={() => setSelectedStation(null)}
              sx={{
                textTransform: "none",
                color: "#64748b",
                fontWeight: 700,
                fontSize: "0.75rem",
              }}
            >
              Dismiss
            </Button>
          </Box>

          {/* Wide Telemetry Metrics Grid */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, 1fr)",
                sm: "repeat(3, 1fr)",
                md: "repeat(6, 1fr)",
              },
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "#64748b", fontWeight: 700, display: "block" }}
              >
                PM2.5 (Fine Particles)
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: getAirQualityMeta(selectedStation.pm25).badgeColor,
                }}
              >
                {selectedStation.pm25 != null
                  ? `${Number(selectedStation.pm25).toFixed(1)} µg/m³`
                  : "—"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.68rem" }}>
                WHO target: ≤10 µg/m³
              </Typography>
            </Box>

            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "#64748b", fontWeight: 700, display: "block" }}
              >
                PM10 (Coarse Particles)
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, color: "#1e293b" }}
              >
                {selectedStation.pm10 != null
                  ? `${Number(selectedStation.pm10).toFixed(1)} µg/m³`
                  : "—"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.68rem" }}>
                EU limit: 40 µg/m³
              </Typography>
            </Box>

            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "#64748b", fontWeight: 700, display: "block" }}
              >
                NO₂ (Nitrogen Dioxide)
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, color: "#1e293b" }}
              >
                {selectedStation.no2 != null
                  ? `${Number(selectedStation.no2).toFixed(1)} µg/m³`
                  : "—"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.68rem" }}>
                Traffic / Combustion
              </Typography>
            </Box>

            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "#64748b", fontWeight: 700, display: "block" }}
              >
                O₃ (Ground Ozone)
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, color: "#1e293b" }}
              >
                {selectedStation.o3 != null
                  ? `${Number(selectedStation.o3).toFixed(1)} µg/m³`
                  : "—"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.68rem" }}>
                Photochemical smog
              </Typography>
            </Box>

            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "#64748b", fontWeight: 700, display: "block" }}
              >
                CO (Carbon Monoxide)
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, color: "#1e293b" }}
              >
                {formatCoValue(selectedStation.co)}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.68rem" }}>
                EU limit: 10 mg/m³
              </Typography>
            </Box>

            <Box
              sx={{
                p: 1.25,
                borderRadius: 2,
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "#64748b", fontWeight: 700, display: "block" }}
              >
                Microclimate & Wind
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 800, color: "#0f172a", mt: 0.5 }}
              >
                💨 {selectedStation.windSpeed != null ? `${Number(selectedStation.windSpeed).toFixed(1)} km/h` : "—"}{" "}
                {degreesToCompass(selectedStation.windDirection)}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "#64748b", display: "block", fontSize: "0.68rem" }}
              >
                💧 {selectedStation.humidity != null ? `${Number(selectedStation.humidity).toFixed(0)}%` : "—"} · ⏱️ {selectedStation.pressure != null ? `${Number(selectedStation.pressure).toFixed(0)} mb` : "—"}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      <Snackbar
        open={Boolean(notification)}
        autoHideDuration={4500}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {notification ? (
          <Alert
            onClose={() => setNotification(null)}
            severity={notification.severity}
            sx={{ width: "100%", fontWeight: 600, boxShadow: 4 }}
          >
            {notification.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Card>
  );
}