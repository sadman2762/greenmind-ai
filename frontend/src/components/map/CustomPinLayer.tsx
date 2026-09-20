import React, { useMemo } from "react";
import L from "leaflet";
import { Circle, Marker, Popup } from "react-leaflet";
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

import { useSimulation } from "../../context/SimulationContext";
import { TIER_CONFIGS, type SensorTier } from "../../types/budget";
import type { Station } from "../../types/station";

interface CustomPinLayerProps {
  stations: Station[];
}

const createCustomTierPinIcon = (tier: SensorTier = "iot") => {
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
    className: `custom-pin-marker-${tier}`,
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

const CustomPinLayer = React.memo(function CustomPinLayer({ stations }: CustomPinLayerProps) {
  const {
    simulatedStations,
    updateCustomPin,
    removeSimulatedStation,
    updateStationTier,
  } = useSimulation();

  const customPins = useMemo(
    () => simulatedStations.filter((station) => station.isCustom),
    [simulatedStations],
  );

  const icons = useMemo(
    () => ({
      reference: createCustomTierPinIcon("reference"),
      micro: createCustomTierPinIcon("micro"),
      iot: createCustomTierPinIcon("iot"),
    }),
    [],
  );

  if (customPins.length === 0) {
    return null;
  }

  return (
    <>
      {customPins.map((station) => {
        const rec = station.recommendation;
        const tier = (station.sensorTier as SensorTier) || "iot";
        const tierConfig = TIER_CONFIGS[tier] || TIER_CONFIGS.iot;

        const markerColor = tierConfig.color;
        const fillColor = tierConfig.borderColor;
        const radiusMeters = tierConfig.radiusKm * 1000;
        const icon = icons[tier] || icons.iot;

        return (
          <Box key={`custom-pin-${station.id}`} component="span">
            {/* Real-time category-specific coverage halo */}
            <Circle
              center={[station.lat, station.lng]}
              radius={radiusMeters}
              pathOptions={{
                color: markerColor,
                fillColor: fillColor,
                fillOpacity: tier === "reference" ? 0.08 : 0.05,
                opacity: 0.6,
                weight: tier === "reference" ? 2.5 : 1.5,
                dashArray: tier === "reference" ? "6 6" : "8 8",
              }}
            />

            {/* Draggable Custom Sensor Marker */}
            <Marker
              position={[station.lat, station.lng]}
              icon={icon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  updateCustomPin(
                    station.id,
                    pos.lat,
                    pos.lng,
                    stations,
                  );
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
                        Custom {tierConfig.name}
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
                        Draggable Sensor · #{station.id}
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
                          🏛️ Reference
                        </MenuItem>
                        <MenuItem value="micro" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          📡 Micro
                        </MenuItem>
                        <MenuItem value="iot" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          📶 IoT Mesh
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Hero Card for PM2.5 (Estimated) - Matching Implemented Station Popup */}
                  {(() => {
                    const pm25Val = Number(rec?.estimatedPm25 ?? station.pm25 ?? 5.1);
                    const isGood = pm25Val <= 10;
                    return (
                      <Box
                        sx={{
                          p: 0.75,
                          borderRadius: 1.5,
                          backgroundColor: isGood ? "#f0fdf4" : "#fffbeb",
                          border: `1px solid ${isGood ? "#bbf7d0" : "#fde68a"}`,
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
                              color: isGood ? "#15803d" : "#b45309",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              fontSize: "0.65rem",
                            }}
                          >
                            KEY POLLUTANT · PM2.5 (EST.)
                          </Typography>
                          <Box
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              px: 0.75,
                              py: 0.1,
                              borderRadius: "999px",
                              backgroundColor: isGood ? "#dcfce7" : "#fef3c7",
                              border: `1px solid ${isGood ? "#86efac" : "#fcd34d"}`,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: "0.62rem",
                                fontWeight: 800,
                                color: isGood ? "#166534" : "#92400e",
                              }}
                            >
                              {isGood ? "Good · WHO Target" : "Moderate"}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
                            <Typography
                              sx={{
                                fontSize: "1.45rem",
                                fontWeight: 900,
                                lineHeight: 1.1,
                                color: isGood ? "#14532d" : "#78350f",
                              }}
                            >
                              {pm25Val.toFixed(1)}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color: isGood ? "#166534" : "#92400e",
                                fontSize: "0.75rem",
                              }}
                            >
                              µg/m³
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "#64748b",
                              fontSize: "0.65rem",
                              fontWeight: 500,
                            }}
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
                    {/* Daytime Noise */}
                    <Box
                      sx={{
                        p: 0.5,
                        borderRadius: 1.2,
                        backgroundColor: "#faf5ff",
                        border: "1px solid #f3e8ff",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: "#7e22ce",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          lineHeight: 1.2,
                        }}
                      >
                        Acoustic Noise
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.35, mt: 0.2 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: "#581c87", lineHeight: 1.1 }}>
                          {rec?.estimatedDaytimeNoise != null ? Number(rec.estimatedDaytimeNoise).toFixed(1) : "52.4"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: "#9333ea" }}>
                          dB
                        </Typography>
                      </Box>
                    </Box>

                    {/* Groundwater Conductivity */}
                    <Box
                      sx={{
                        p: 0.5,
                        borderRadius: 1.2,
                        backgroundColor: "#eff6ff",
                        border: "1px solid #dbeafe",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: "#1d4ed8",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          lineHeight: 1.2,
                        }}
                      >
                        Groundwater Cond.
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.35, mt: 0.2 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: "#1e3a8a", lineHeight: 1.1 }}>
                          {rec?.estimatedConductivity != null ? Number(rec.estimatedConductivity).toFixed(2) : "1.05"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: "#2563eb" }}>
                          mS/cm
                        </Typography>
                      </Box>
                    </Box>

                    {/* Priority Score */}
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
                          display: "block",
                          color: "#475569",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          lineHeight: 1.2,
                        }}
                      >
                        Priority Score
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.35, mt: 0.2 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: markerColor, lineHeight: 1.1 }}>
                          {rec?.priorityScore ?? 70}
                        </Typography>
                        <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: "#64748b" }}>
                          /100
                        </Typography>
                      </Box>
                    </Box>

                    {/* Nearest Station */}
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
                          display: "block",
                          color: "#475569",
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          lineHeight: 1.2,
                        }}
                      >
                        Nearest Station
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          color: "#1e293b",
                          lineHeight: 1.2,
                          mt: 0.2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={rec?.nearestStation || "Debrecen Active Mesh"}
                      >
                        {rec?.nearestStation || "Debrecen Active Mesh"}
                      </Typography>
                    </Box>
                  </Box>

                  {/* 3-Column Micro Specs Strip */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 0.4,
                      p: 0.4,
                      borderRadius: 1.5,
                      backgroundColor: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      mb: 0.5,
                      textAlign: "center",
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#64748b", display: "block" }}>
                        CapEx
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#0f172a" }}>
                        €{((tierConfig?.unitCost ?? 1200) / 1000).toFixed(1)}k
                      </Typography>
                    </Box>
                    <Box sx={{ borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>
                      <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#64748b", display: "block" }}>
                        Coverage Radius
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: markerColor }}>
                        {tierConfig?.radiusKm ?? 0.8} km
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#64748b", display: "block" }}>
                        Annual O&M
                      </Typography>
                      <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#0f172a" }}>
                        €{tierConfig?.annualOm ?? 150}/yr
                      </Typography>
                    </Box>
                  </Box>

                  {/* Location & GPS Footer (Exact Match to Implemented Station) */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      pt: 0.4,
                      pb: 0.5,
                      borderTop: "1px solid #f1f5f9",
                      mb: 0.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.72rem", lineHeight: 1 }}>📍</Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color: "#475569",
                          fontSize: "0.68rem",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        Draggable Pin
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        px: 0.6,
                        py: 0.15,
                        borderRadius: 1,
                        backgroundColor: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        fontFamily: "monospace",
                        fontSize: "0.64rem",
                        color: "#475569",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {(Number(station.lat) || 0).toFixed(4)}, {(Number(station.lng) || 0).toFixed(4)}
                    </Box>
                  </Box>

                  {/* Action Button */}
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon sx={{ fontSize: "14px !important" }} />}
                    onClick={() => removeSimulatedStation(station.id)}
                    sx={{
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      py: 0.35,
                      borderRadius: 1.5,
                      borderColor: "#fecaca",
                      backgroundColor: "#fff",
                      "&:hover": {
                        backgroundColor: "#fef2f2",
                        borderColor: "#ef4444",
                      },
                    }}
                  >
                    Remove This Custom Sensor
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

export default CustomPinLayer;

