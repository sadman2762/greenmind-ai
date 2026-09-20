import React, { useMemo } from "react";
import L from "leaflet";
import { Circle, Marker, Popup } from "react-leaflet";
import {
  Box,
  Button,
  Chip,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

import { useSimulation } from "../../context/SimulationContext";
import { TIER_CONFIGS, type SensorTier } from "../../types/budget";
import type { Station } from "../../types/station";

interface SimulatedSensorLayerProps {
  stations?: Station[];
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

const createTierPinIcon = (tier?: SensorTier) => {
  let bgGradient = "linear-gradient(135deg, #0f766e 0%, #047857 100%)";
  let borderColor = "#14b8a6";
  let glowColor = "rgba(20, 184, 166, 0.4)";
  let symbol = "📶";
  let size = 26;

  if (tier === "reference") {
    bgGradient = "linear-gradient(135deg, #b45309 0%, #d97706 100%)";
    borderColor = "#f59e0b";
    glowColor = "rgba(245, 158, 11, 0.5)";
    symbol = "🏛️";
    size = 32;
  } else if (tier === "micro") {
    bgGradient = "linear-gradient(135deg, #6b21a8 0%, #9333ea 100%)";
    borderColor = "#a855f7";
    glowColor = "rgba(168, 85, 247, 0.45)";
    symbol = "📡";
    size = 28;
  }

  const outerSize = size + 10;

  return L.divIcon({
    className: `simulated-sensor-marker-${tier || "default"}`,
    html: `
      <div style="
        position: relative;
        width: ${outerSize}px;
        height: ${outerSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
      ">
        <div style="
          position: absolute;
          width: ${outerSize}px;
          height: ${outerSize}px;
          border-radius: 50%;
          background: ${glowColor};
          border: 1.5px solid ${borderColor};
          box-shadow: 0 0 10px ${glowColor};
        "></div>
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${bgGradient};
          border: 2px solid #ffffff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: ${tier === "reference" ? 14 : 12}px;
        ">
          ${symbol}
        </div>
      </div>
    `,
    iconSize: [outerSize, outerSize],
    iconAnchor: [outerSize / 2, outerSize / 2],
    popupAnchor: [0, -outerSize / 2],
  });
};

const SimulatedSensorLayer = React.memo(function SimulatedSensorLayer({ stations = [] }: SimulatedSensorLayerProps) {
  const {
    simulatedStations,
    removeSimulatedStation,
    updateStationPosition,
    updateStationTier,
  } = useSimulation();

  const aiStations = simulatedStations.filter((station) => !station.isCustom);

  const icons = useMemo(
    () => ({
      reference: createTierPinIcon("reference"),
      micro: createTierPinIcon("micro"),
      iot: createTierPinIcon("iot"),
      default: createTierPinIcon(),
    }),
    [],
  );

  return (
    <>
      {aiStations.map((station) => {
        const recommendation = station.recommendation;
        const tier = (station.sensorTier as SensorTier) || "iot";
        const tierConfig = TIER_CONFIGS[tier];

        const markerColor = tierConfig ? tierConfig.color : "#0f766e";
        const fillColor = tierConfig ? tierConfig.borderColor : "#14b8a6";
        const coverageRadiusMeters = tierConfig
          ? tierConfig.radiusKm * 1000
          : 1500;

        const icon = icons[tier] || icons.default;

        return (
          <Box key={`sim-sensor-${station.id}`} component="span">
            {/* Dynamic Coverage Halo moving with the marker */}
            <Circle
              center={[station.lat, station.lng]}
              radius={coverageRadiusMeters}
              pathOptions={{
                color: markerColor,
                fillColor: fillColor,
                fillOpacity: tier === "reference" ? 0.08 : 0.04,
                opacity: 0.5,
                weight: tier === "reference" ? 2.5 : 1.5,
                dashArray: tier === "reference" ? "6 6" : "8 8",
              }}
            />

            {/* Draggable Station Marker */}
            <Marker
              position={[station.lat, station.lng]}
              icon={icon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  updateStationPosition(station.id, pos.lat, pos.lng, stations);
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
                offset={[0, -10]}
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
                        {station.name}
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
                        #{station.id} · AI Simulated Station
                      </Typography>
                    </Box>

                    {/* Compact Interactive Tier Selector */}
                    <FormControl size="small" variant="standard" sx={{ m: 0 }}>
                      <Select
                        value={tier}
                        disableUnderline
                        onChange={(e) => {
                          const newTier = e.target.value as SensorTier;
                          updateStationTier(station.id, newTier, TIER_CONFIGS[newTier]);
                        }}
                        sx={{
                          height: 22,
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          backgroundColor: tierConfig?.bgColor || "#ecfdf5",
                          color: markerColor,
                          border: `1px solid ${tierConfig?.borderColor || "#a7f3d0"}`,
                          borderRadius: 1,
                          px: 0.75,
                          "& .MuiSelect-select": {
                            py: 0,
                            pr: "18px !important",
                          },
                          "& .MuiSvgIcon-root": {
                            fontSize: 14,
                            color: markerColor,
                            right: 2,
                          },
                        }}
                      >
                        <MenuItem value="reference" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          🏛️ Tier 1: Reference
                        </MenuItem>
                        <MenuItem value="micro" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          📡 Tier 2: Micro
                        </MenuItem>
                        <MenuItem value="iot" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          📶 Tier 3: IoT Mesh
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Hero Card for PM2.5 (Estimated) - Matching Implemented Station Popup */}
                  {(() => {
                    const pm25Val = recommendation?.estimatedPm25 ?? station.pm25 ?? 5.1;
                    const aq = getAirQualityMeta(pm25Val);
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
                            mb: 0.25,
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
                            Key Pollutant · PM2.5 (Est.)
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
                            {Number(pm25Val).toFixed(1)}
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

                  {/* 2x2 Telemetry Grid */}
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
                        PM10 (Est.)
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, color: "#1e293b", fontSize: "0.78rem" }}
                      >
                        {recommendation?.estimatedPm10 != null
                          ? `${Number(recommendation.estimatedPm10).toFixed(1)} µg/m³`
                          : `${(Number(recommendation?.estimatedPm25 ?? station.pm25 ?? 5.1) * 1.8).toFixed(1)} µg/m³`}
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
                        NO₂ (Nitrogen Est.)
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, color: "#1e293b", fontSize: "0.78rem" }}
                      >
                        {recommendation?.estimatedNo2 != null
                          ? `${Number(recommendation.estimatedNo2).toFixed(1)} µg/m³`
                          : "14.2 µg/m³"}
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
                        Acoustic Noise
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, color: "#1e293b", fontSize: "0.78rem" }}
                      >
                        {recommendation?.estimatedDaytimeNoise != null
                          ? `${Number(recommendation.estimatedDaytimeNoise).toFixed(1)} dB`
                          : "52.4 dB"}
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
                        Groundwater Cond.
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, color: "#1e293b", fontSize: "0.78rem" }}
                      >
                        {recommendation?.estimatedConductivity != null
                          ? `${Number(recommendation.estimatedConductivity).toFixed(2)} mS/cm`
                          : "1.05 mS/cm"}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Micro 3-Column Strip (CapEx, Radius, ML Gain) */}
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
                        💰 CapEx
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
                        €{tierConfig.unitCost.toLocaleString()}
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
                        🎯 Radius
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
                        {tierConfig.radiusKm} km
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
                        ⚡ ML Gain
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
                        {recommendation?.informationGainScore != null
                          ? `${Number(recommendation.informationGainScore).toFixed(1)}%`
                          : "62%"}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Location & GPS Coordinates Footer */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      pt: 0.4,
                      borderTop: "1px solid #f1f5f9",
                      mb: 0.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.72rem" }}>📍</Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#475569",
                          fontWeight: 600,
                          fontSize: "0.68rem",
                        }}
                        noWrap
                      >
                        {recommendation?.nearestStation
                          ? `Near ${recommendation.nearestStation}`
                          : "Debrecen Sentinel Grid"}
                      </Typography>
                    </Box>

                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.65rem",
                        color: "#475569",
                        backgroundColor: "#f1f5f9",
                        px: 0.6,
                        py: 0.2,
                        borderRadius: 1,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {(Number(station.lat) || 0).toFixed(4)}, {(Number(station.lng) || 0).toFixed(4)}
                    </Typography>
                  </Box>

                  {/* Remove from Simulation Button */}
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon style={{ fontSize: 14 }} />}
                    onClick={() => removeSimulatedStation(station.id)}
                    sx={{
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      py: 0.35,
                      borderRadius: 1.5,
                      borderColor: "#fecaca",
                      color: "#dc2626",
                      "&:hover": {
                        borderColor: "#f87171",
                        backgroundColor: "#fef2f2",
                      },
                    }}
                  >
                    Remove From Simulation
                  </Button>
                </Box>
              </Popup>
            </Marker>
          </Box>
        );
      })}
    </>
  );
});

export default SimulatedSensorLayer;
