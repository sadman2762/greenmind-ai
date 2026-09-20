import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import BuildCircleRoundedIcon from "@mui/icons-material/BuildCircleRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SensorsRoundedIcon from "@mui/icons-material/SensorsRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import EngineeringRoundedIcon from "@mui/icons-material/EngineeringRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { Link } from "react-router-dom";
import { useAppTheme } from "../../context/ThemeContext";
import { useMaintenance } from "../../context/MaintenanceContext";
import {
  fetchSensorHealth,
  registerNewSensorApi,
  removeSensorApi,
  type SensorDiagnostic,
  type SensorHealthResponse,
} from "../../services/sensorHealthService";

type StatusFilter = "ALL" | "CRITICAL" | "WARNING" | "OPTIMAL";
type SortOption = "DAYS_ASC" | "HEALTH_ASC" | "CODE_ASC";

export default function SensorHealth() {
  const { tokens, isMidnight } = useAppTheme();
  const { isStationScheduled, dispatchOrder } = useMaintenance();

  const [data, setData] = useState<SensorHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("DAYS_ASC");
  const [selectedStation, setSelectedStation] = useState<SensorDiagnostic | null>(null);

  // Add Sensor Dialog State
  const [isAddSensorOpen, setIsAddSensorOpen] = useState(false);
  const [isSubmittingSensor, setIsSubmittingSensor] = useState(false);
  const [addSensorError, setAddSensorError] = useState<string | null>(null);

  // Remove Sensor Dialog State
  const [sensorToRemove, setSensorToRemove] = useState<SensorDiagnostic | null>(null);
  const [isRemovingSensor, setIsRemovingSensor] = useState(false);
  const [removeNotification, setRemoveNotification] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const handleConfirmRemoveSensor = async () => {
    if (!sensorToRemove) return;
    setIsRemovingSensor(true);
    setRemoveError(null);
    try {
      const res = await removeSensorApi(sensorToRemove.stationCode);
      setData(res.fleetReport);
      setRemoveNotification(
        `Sensor ${sensorToRemove.stationCode} (${sensorToRemove.name}) has been successfully decommissioned and removed from the active fleet.`
      );
      if (selectedStation?.stationCode === sensorToRemove.stationCode) {
        setSelectedStation(null);
      }
      setSensorToRemove(null);
    } catch (err: any) {
      console.error("Failed to remove sensor:", err);
      setRemoveError(err?.message || "Failed to decommission sensor.");
    } finally {
      setIsRemovingSensor(false);
    }
  };

  // New Sensor Form Fields
  const [sensorCode, setSensorCode] = useState("ST-AIR-08");
  const [sensorName, setSensorName] = useState("Debrecen Innovation Hub Node");
  const [sensorCategory, setSensorCategory] = useState<"AIR" | "NOISE" | "WATER">("AIR");
  const [sensorType, setSensorType] = useState("Laser Optical Particle Counter (PM2.5 / PM10)");
  const [sensorLat, setSensorLat] = useState("47.5316");
  const [sensorLng, setSensorLng] = useState("21.6273");
  const [sensorHealth, setSensorHealth] = useState("98");
  const [sensorDays, setSensorDays] = useState("120");

  const handleOpenAddSensor = () => {
    const randomId = Math.floor(10 + Math.random() * 90);
    setSensorCode(`ST-AIR-${randomId}`);
    setSensorName("Debrecen Innovation Park Station");
    setSensorCategory("AIR");
    setSensorType("Laser Optical Particle Counter (PM2.5 / PM10)");
    setSensorLat("47.5316");
    setSensorLng("21.6273");
    setSensorHealth("98");
    setSensorDays("120");
    setAddSensorError(null);
    setIsAddSensorOpen(true);
  };

  const handleCategoryChange = (cat: "AIR" | "NOISE" | "WATER") => {
    setSensorCategory(cat);
    const randomId = Math.floor(10 + Math.random() * 90);
    setSensorCode(`ST-${cat}-${randomId}`);
    if (cat === "AIR") {
      setSensorType("Laser Optical Particle Counter (PM2.5 / PM10)");
    } else if (cat === "NOISE") {
      setSensorType("Class 1 Acoustic MEMS Microphone Array");
    } else {
      setSensorType("Electrochemical Multi-Probe Sondes (DO / pH / Turbidity)");
    }
  };

  const handleAddSensorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensorCode.trim() || !sensorName.trim()) {
      setAddSensorError("Station code and location name are required.");
      return;
    }

    const lat = parseFloat(sensorLat);
    const lng = parseFloat(sensorLng);
    const health = parseFloat(sensorHealth);
    const days = parseInt(sensorDays, 10);

    if (isNaN(lat) || isNaN(lng)) {
      setAddSensorError("Coordinates must be valid decimal numbers.");
      return;
    }

    setIsSubmittingSensor(true);
    setAddSensorError(null);
    try {
      await registerNewSensorApi({
        stationCode: sensorCode.trim().toUpperCase(),
        name: sensorName.trim(),
        sensorCategory: sensorCategory,
        sensorType: sensorType.trim() || "Environmental Telemetry Sensor",
        latitude: lat,
        longitude: lng,
        healthScore: isNaN(health) ? 98 : Math.max(10, Math.min(100, health)),
        estimatedDaysToService: isNaN(days) ? 120 : Math.max(1, days),
      });

      // Reload fleet diagnostics report to immediately show the new station
      await loadData();
      setIsAddSensorOpen(false);
    } catch (err: any) {
      console.error("Failed to register sensor:", err);
      setAddSensorError(err?.message || "Failed to register new sensor.");
    } finally {
      setIsSubmittingSensor(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSensorHealth();
      setData(response);
    } catch (err: any) {
      console.error("Failed to load sensor health:", err);
      setError(err?.message || "Failed to load sensor health diagnostics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredStations = useMemo(() => {
    if (!data) return [];
    let list = [...data.stations];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.stationCode.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.primaryRiskFactor.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "ALL") {
      list = list.filter((s) => s.status === statusFilter);
    }

    list.sort((a, b) => {
      if (sortOption === "DAYS_ASC") {
        return a.estimatedDaysToService - b.estimatedDaysToService;
      }
      if (sortOption === "HEALTH_ASC") {
        return a.healthScore - b.healthScore;
      }
      return a.stationCode.localeCompare(b.stationCode);
    });

    return list;
  }, [data, searchQuery, statusFilter, sortOption]);

  const getStatusColor = (status: "OPTIMAL" | "WARNING" | "CRITICAL") => {
    switch (status) {
      case "CRITICAL":
        return {
          main: "#dc2626",
          bg: "#fef2f2",
          border: "#fecaca",
          textPrimary: "#991b1b",
          textSecondary: "#7f1d1d",
          label: "Critical Action Required",
          icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 18 }} />,
        };
      case "WARNING":
        return {
          main: "#d97706",
          bg: "#fffbeb",
          border: "#fde68a",
          textPrimary: "#92400e",
          textSecondary: "#78350f",
          label: "Maintenance Warning",
          icon: <WarningAmberRoundedIcon sx={{ fontSize: 18 }} />,
        };
      case "OPTIMAL":
      default:
        return {
          main: "#059669",
          bg: "#f0fdf4",
          border: "#bbf7d0",
          textPrimary: "#166534",
          textSecondary: "#14532d",
          label: "Nominal & Healthy",
          icon: <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />,
        };
    }
  };

  const handleScheduleOrder = async (station: SensorDiagnostic) => {
    const daysOut =
      station.status === "CRITICAL" ? 1 : station.status === "WARNING" ? 4 : 21;
    const targetDate = new Date(Date.now() + 86400000 * daysOut)
      .toISOString()
      .split("T")[0];
    const priority =
      station.status === "CRITICAL"
        ? "CRITICAL"
        : station.status === "WARNING"
          ? "HIGH"
          : "ROUTINE";

    await dispatchOrder({
      stationCode: station.stationCode,
      stationName: station.name,
      sensorType: station.sensorType,
      priority,
      scheduledDate: targetDate,
      scheduledTime: "10:00",
      assignedTechnician: "Gábor Kovács (Senior Field Tech)",
      issueDescription: `${station.primaryRiskFactor} (Health: ${station.healthScore}%, Est RUL: ~${station.estimatedDaysToService} days)`,
      actionRequired: station.recommendedAction,
      estimatedHours: 2.0,
      notes: "Auto-dispatched from ML Predictive Maintenance diagnostics.",
    });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1440, mx: "auto" }}>
      {/* Header Banner */}
      <Box
        sx={{
          mb: 3.5,
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 4,
          background: `linear-gradient(135deg, ${tokens.cardBg} 0%, rgba(0, 220, 130, 0.05) 100%)`,
          border: `1px solid ${isMidnight ? "rgba(0, 220, 130, 0.2)" : "#bbf7d0"}`,
          boxShadow: tokens.cardShadow,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2.5,
        }}
      >
        {/* Subtle decorative radial accent */}
        <Box
          sx={{
            position: "absolute",
            top: -50,
            right: -50,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 220, 130, 0.12) 0%, rgba(0,0,0,0) 70%)",
            pointerEvents: "none",
          }}
        />

        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 220, 130, 0.12)",
                color: isMidnight ? "#00dc82" : "#059669",
                border: "1px solid rgba(0, 220, 130, 0.25)",
              }}
            >
              <BuildCircleRoundedIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "1.45rem", md: "1.85rem" },
                  color: tokens.textPrimary,
                  letterSpacing: "-0.02em",
                }}
              >
                Sensor Health & Predictive Maintenance
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                <Chip
                  size="small"
                  label="Weibull AFT Machine Learning"
                  sx={{
                    height: 22,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    backgroundColor: "rgba(0, 220, 130, 0.15)",
                    color: isMidnight ? "#00dc82" : "#065f46",
                    border: "1px solid rgba(0, 220, 130, 0.3)",
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: tokens.textSecondary, fontWeight: 600 }}
                >
                  Debrecen Municipal IoT Monitoring Fleet
                </Typography>
              </Box>
            </Box>
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: tokens.textSecondary,
              maxWidth: 780,
              lineHeight: 1.6,
              mt: 1,
              fontSize: "0.92rem",
            }}
          >
            Machine Learning algorithms track signal jitter, zero-point baseline drift, and
            packet transmission dropouts to estimate Remaining Useful Life (RUL) and dispatch
            preventive field service work orders before failure occurs.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={handleOpenAddSensor}
            sx={{
              borderRadius: 2.5,
              px: 2.5,
              py: 1,
              fontWeight: 800,
              fontSize: "0.85rem",
              textTransform: "none",
              backgroundColor: "#00dc82",
              color: "#0b1329",
              boxShadow: "0 2px 10px rgba(0, 220, 130, 0.25)",
              "&:hover": {
                backgroundColor: "#00c474",
                boxShadow: "0 4px 14px rgba(0, 220, 130, 0.35)",
              },
            }}
          >
            + Add New Sensor
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={loadData}
            disabled={loading}
            sx={{
              borderRadius: 2.5,
              px: 2.5,
              py: 1,
              fontWeight: 700,
              fontSize: "0.85rem",
              textTransform: "none",
              borderColor: isMidnight ? "rgba(0, 220, 130, 0.3)" : "#cbd5e1",
              color: tokens.textPrimary,
              backgroundColor: tokens.cardBg,
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              "&:hover": {
                borderColor: tokens.accent,
                backgroundColor: "rgba(0, 220, 130, 0.08)",
              },
            }}
          >
            Refresh Telemetry
          </Button>
        </Box>
      </Box>

      {/* KPI Metric Cards - Strictly Uniform */}
      {data && (
        <Grid container spacing={2.5} sx={{ mb: 3.5, alignItems: "stretch" }}>
          {/* Card 1: Fleet Health Score */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                p: 2.5,
                height: "100%",
                minHeight: 165,
                borderRadius: 3.5,
                backgroundColor: tokens.cardBg,
                border: `1px solid ${tokens.cardBorder}`,
                boxShadow: tokens.cardShadow,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                  <Typography variant="overline" sx={{ color: tokens.textMuted, fontWeight: 800 }}>
                    Fleet Health Score
                  </Typography>
                  <SpeedRoundedIcon sx={{ color: isMidnight ? "#00dc82" : tokens.primary, fontSize: 22 }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: tokens.textPrimary }}>
                    {data.fleetSummary.fleetHealthScore}%
                  </Typography>
                  <Chip
                    size="small"
                    label={data.fleetSummary.fleetHealthScore >= 80 ? "Optimal Grade" : "Good"}
                    sx={{
                      fontWeight: 700,
                      height: 22,
                      fontSize: "0.72rem",
                      backgroundColor: isMidnight ? "rgba(0,220,130,0.18)" : "#d1fae5",
                      color: isMidnight ? "#00dc82" : "#047857",
                    }}
                  />
                </Box>
              </Box>
              <Box sx={{ mt: "auto", pt: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={data.fleetSummary.fleetHealthScore}
                  sx={{
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: isMidnight ? "rgba(0,0,0,0.06)" : "#e2e8f0",
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 2.5,
                      backgroundColor: isMidnight ? "#00dc82" : tokens.primary,
                    },
                  }}
                />
              </Box>
            </Card>
          </Grid>

          {/* Card 2: Active Sensor Fleet */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                p: 2.5,
                height: "100%",
                minHeight: 165,
                borderRadius: 3.5,
                backgroundColor: tokens.cardBg,
                border: `1px solid ${tokens.cardBorder}`,
                boxShadow: tokens.cardShadow,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                  <Typography variant="overline" sx={{ color: tokens.textMuted, fontWeight: 800 }}>
                    Active Sensor Fleet
                  </Typography>
                  <SensorsRoundedIcon sx={{ color: "#38bdf8", fontSize: 22 }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: tokens.textPrimary }}>
                    {data.fleetSummary.totalStations}
                  </Typography>
                  <Typography variant="body2" sx={{ color: tokens.textSecondary, fontWeight: 600 }}>
                    Nodes Online
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ mt: "auto", pt: 1.5 }}>
                <Typography variant="caption" noWrap sx={{ display: "block", color: tokens.textMuted }}>
                  16 Air Stations · 5 Acoustic Poles
                </Typography>
              </Box>
            </Card>
          </Grid>

          {/* Card 3: Work Orders Required - Strictly Uniform Size */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                p: 2.5,
                height: "100%",
                minHeight: 165,
                borderRadius: 3.5,
                backgroundColor: tokens.cardBg,
                border: `1px solid ${tokens.cardBorder}`,
                boxShadow: tokens.cardShadow,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                  <Typography variant="overline" sx={{ color: tokens.textMuted, fontWeight: 800 }}>
                    Work Orders Required
                  </Typography>
                  <EngineeringRoundedIcon sx={{ color: "#f59e0b", fontSize: 22 }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 900,
                      color: data.fleetSummary.criticalCount > 0 ? "#ef4444" : "#f59e0b",
                    }}
                  >
                    {data.fleetSummary.warningCount + data.fleetSummary.criticalCount}
                  </Typography>
                  <Chip
                    size="small"
                    label={data.fleetSummary.criticalCount > 0 ? `${data.fleetSummary.criticalCount} Urgent` : "Routine Advisory"}
                    sx={{
                      fontWeight: 700,
                      height: 22,
                      fontSize: "0.72rem",
                      backgroundColor: isMidnight ? "rgba(245,158,11,0.18)" : "#fef3c7",
                      color: "#f59e0b",
                    }}
                  />
                </Box>
              </Box>
              <Box sx={{ mt: "auto", pt: 1.5 }}>
                <Typography variant="caption" noWrap sx={{ display: "block", color: tokens.textMuted }}>
                  Dust cleaning & zero baseline resets
                </Typography>
              </Box>
            </Card>
          </Grid>

          {/* Card 4: Avg Useful Life (RUL) */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                p: 2.5,
                height: "100%",
                minHeight: 165,
                borderRadius: 3.5,
                backgroundColor: tokens.cardBg,
                border: `1px solid ${tokens.cardBorder}`,
                boxShadow: tokens.cardShadow,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                  <Typography variant="overline" sx={{ color: tokens.textMuted, fontWeight: 800 }}>
                    Avg Useful Life (RUL)
                  </Typography>
                  <AssignmentTurnedInRoundedIcon sx={{ color: "#a855f7", fontSize: 22 }} />
                </Box>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: tokens.textPrimary }}>
                    {data.fleetSummary.avgDaysToService}
                  </Typography>
                  <Typography variant="body2" sx={{ color: tokens.textSecondary, fontWeight: 600 }}>
                    Days
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ mt: "auto", pt: 1.5 }}>
                <Typography variant="caption" noWrap sx={{ display: "block", color: tokens.textMuted }}>
                  Earliest service: ~{data.fleetSummary.earliestDays} days
                </Typography>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search & Filter Toolbar */}
      <Card
        sx={{
          p: 2,
          mb: 3.5,
          borderRadius: 3.5,
          backgroundColor: tokens.cardBg,
          border: `1px solid ${tokens.cardBorder}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          {/* Search Input */}
          <TextField
            size="small"
            placeholder="Search by station code, location name, or failure mode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: tokens.textMuted }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              minWidth: { xs: "100%", md: 360 },
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                backgroundColor: isMidnight ? "rgba(255,255,255,0.03)" : "#f8fafc",
              },
            }}
          />

          {/* Filter Chips & Sorting */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1,
            }}
          >
            <FilterListRoundedIcon sx={{ color: tokens.textMuted, fontSize: 20 }} />
            {(["ALL", "CRITICAL", "WARNING", "OPTIMAL"] as StatusFilter[]).map((status) => {
              const isSelected = statusFilter === status;
              const label =
                status === "ALL"
                  ? "All Stations"
                  : status === "CRITICAL"
                    ? "Critical"
                    : status === "WARNING"
                      ? "Advisory Warning"
                      : "Optimal";

              return (
                <Chip
                  key={status}
                  label={label}
                  clickable
                  onClick={() => setStatusFilter(status)}
                  sx={{
                    fontWeight: 700,
                    borderRadius: 2,
                    border: isSelected
                      ? `1.5px solid ${tokens.primary}`
                      : `1px solid ${isMidnight ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                    backgroundColor: isSelected
                      ? isMidnight
                        ? "rgba(0, 220, 130, 0.15)"
                        : "#dcfce7"
                      : "transparent",
                    color: isSelected ? (isMidnight ? "#00dc82" : tokens.primary) : tokens.textSecondary,
                  }}
                />
              );
            })}

            <Select
              size="small"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              sx={{
                borderRadius: 2.5,
                fontSize: "0.85rem",
                fontWeight: 600,
                ml: { xs: 0, md: 1 },
                backgroundColor: isMidnight ? "rgba(255,255,255,0.03)" : "#f8fafc",
              }}
            >
              <MenuItem value="DAYS_ASC">Shortest Service RUL</MenuItem>
              <MenuItem value="HEALTH_ASC">Lowest Health Score</MenuItem>
              <MenuItem value="CODE_ASC">Station Code (A-Z)</MenuItem>
            </Select>
          </Box>
        </Box>
      </Card>

      {/* Loading & Error States */}
      {loading && (
        <Box sx={{ py: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <CircularProgress size={44} sx={{ color: tokens.primary }} />
          <Typography variant="body2" sx={{ color: tokens.textSecondary }}>
            Computing time-series degradation models and Remaining Useful Life...
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stations Diagnostic Grid */}
      {!loading && !error && (
        <Grid container spacing={2.5}>
          {filteredStations.map((station) => {
            const statusInfo = getStatusColor(station.status);
            const isScheduled = isStationScheduled(station.stationCode);

            return (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={station.stationCode}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 3.5,
                    backgroundColor: tokens.cardBg,
                    border: `1px solid ${station.status !== "OPTIMAL" ? statusInfo.border : tokens.cardBorder}`,
                    boxShadow: isMidnight
                      ? "0 10px 24px rgba(0, 0, 0, 0.25)"
                      : "0 4px 16px rgba(0, 0, 0, 0.03)",
                    transition: "transform 180ms ease, box-shadow 180ms ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: isMidnight
                        ? "0 14px 30px rgba(0, 0, 0, 0.35)"
                        : "0 8px 22px rgba(0, 0, 0, 0.08)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 2.5, flexGrow: 1, display: "flex", flexDirection: "column" }}>
                    {/* Top Row: Station Code & Status Chip */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                          <Chip
                            size="small"
                            label={station.stationCode}
                            sx={{
                              fontWeight: 800,
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              backgroundColor: isMidnight ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                              color: tokens.textPrimary,
                            }}
                          />
                          <Chip
                            size="small"
                            label={station.sensorCategory}
                            sx={{
                              fontWeight: 700,
                              fontSize: "0.68rem",
                              height: 20,
                              backgroundColor:
                                station.sensorCategory === "AIR"
                                  ? isMidnight
                                    ? "rgba(56, 189, 248, 0.15)"
                                    : "#e0f2fe"
                                  : isMidnight
                                    ? "rgba(168, 85, 247, 0.15)"
                                    : "#f3e8ff",
                              color: station.sensorCategory === "AIR" ? "#38bdf8" : "#a855f7",
                            }}
                          />
                        </Box>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 800,
                            fontSize: "1.05rem",
                            color: tokens.textPrimary,
                            lineHeight: 1.3,
                          }}
                        >
                          {station.name}
                        </Typography>
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Chip
                          icon={statusInfo.icon}
                          label={statusInfo.label}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: "0.72rem",
                            backgroundColor: statusInfo.bg,
                            color: statusInfo.main,
                            border: `1px solid ${statusInfo.border}`,
                          }}
                        />
                        <Tooltip title={`Decommission / Remove ${station.stationCode}`}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSensorToRemove(station);
                            }}
                            sx={{
                              p: 0.5,
                              color: tokens.textMuted,
                              "&:hover": {
                                color: "#ef4444",
                                backgroundColor: isMidnight
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : "#fee2e2",
                              },
                            }}
                          >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Health & Remaining Useful Life Strip */}
                    <Box
                      sx={{
                        my: 2,
                        p: 1.75,
                        borderRadius: 2.5,
                        backgroundColor: isMidnight
                          ? "rgba(255, 255, 255, 0.02)"
                          : "#f8fafc",
                        border: `1px solid ${tokens.cardBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, fontWeight: 700, display: "block" }}>
                          Health Index
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: statusInfo.main }}>
                          {station.healthScore}%
                        </Typography>
                      </Box>

                      <Divider orientation="vertical" flexItem sx={{ borderColor: tokens.cardBorder }} />

                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, fontWeight: 700, display: "block" }}>
                          Estimated Service In
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 900,
                            color: station.estimatedDaysToService <= 45 ? "#f59e0b" : tokens.textPrimary,
                          }}
                        >
                          ~{station.estimatedDaysToService}{" "}
                          <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
                            Days
                          </Typography>
                        </Typography>
                      </Box>
                    </Box>

                    {/* Primary Risk & Diagnostic Factor */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: tokens.textMuted, fontWeight: 800, display: "block", mb: 0.5 }}>
                        Primary Degradation Risk
                      </Typography>
                      <Chip
                        label={station.primaryRiskFactor}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          backgroundColor: isMidnight ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                          color: tokens.textPrimary,
                          maxWidth: "100%",
                        }}
                      />
                    </Box>

                    {/* Quick Metric Badges */}
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, mb: 2.5 }}>
                      <Box sx={{ p: 1, borderRadius: 1.5, textAlign: "center", backgroundColor: isMidnight ? "rgba(255,255,255,0.02)" : "#f1f5f9" }}>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, display: "block", fontSize: "0.68rem" }}>
                          Uptime
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: tokens.textPrimary }}>
                          {station.metrics.uptimePct}%
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1, borderRadius: 1.5, textAlign: "center", backgroundColor: isMidnight ? "rgba(255,255,255,0.02)" : "#f1f5f9" }}>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, display: "block", fontSize: "0.68rem" }}>
                          Drift
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: Math.abs(station.metrics.driftPct) > 15 ? "#f59e0b" : tokens.textPrimary }}>
                          {station.metrics.driftPct > 0 ? `+${station.metrics.driftPct}%` : `${station.metrics.driftPct}%`}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1, borderRadius: 1.5, textAlign: "center", backgroundColor: isMidnight ? "rgba(255,255,255,0.02)" : "#f1f5f9" }}>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, display: "block", fontSize: "0.68rem" }}>
                          Signal Jitter
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: station.metrics.signalJitter > 1.5 ? "#ef4444" : tokens.textPrimary }}>
                          {station.metrics.signalJitter}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ mt: "auto", display: "flex", gap: 1 }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => setSelectedStation(station)}
                        sx={{
                          borderRadius: 2.5,
                          py: 0.9,
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          textTransform: "none",
                          borderColor: isMidnight ? "rgba(255,255,255,0.15)" : "#cbd5e1",
                          color: tokens.textPrimary,
                          "&:hover": {
                            borderColor: tokens.primary,
                            backgroundColor: isMidnight
                              ? "rgba(0, 220, 130, 0.08)"
                              : "rgba(16, 185, 129, 0.06)",
                          },
                        }}
                      >
                        Inspect Diagnostics
                      </Button>

                      {station.status !== "OPTIMAL" &&
                        (isScheduled ? (
                          <Button
                            component={Link}
                            to="/maintenance-schedule"
                            variant="contained"
                            sx={{
                              borderRadius: 2.5,
                              px: 1.5,
                              py: 0.9,
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              textTransform: "none",
                              backgroundColor: "#d1fae5",
                              color: "#065f46",
                              border: "1px solid #a7f3d0",
                              boxShadow: "none",
                              "&:hover": {
                                backgroundColor: "#bbf7d0",
                                boxShadow: "none",
                              },
                            }}
                          >
                            In Schedule
                          </Button>
                        ) : (
                          <Button
                            variant="contained"
                            onClick={() => handleScheduleOrder(station)}
                            sx={{
                              borderRadius: 2.5,
                              px: 1.75,
                              py: 0.9,
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              textTransform: "none",
                              backgroundColor: "#f59e0b",
                              color: "#ffffff",
                              boxShadow: "none",
                              "&:hover": {
                                backgroundColor: "#d97706",
                                boxShadow: "none",
                              },
                            }}
                          >
                            Order
                          </Button>
                        ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Diagnostics & Work Order Dialog */}
      <Dialog
        open={Boolean(selectedStation)}
        onClose={() => setSelectedStation(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 4,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
              backgroundImage: "none",
            },
          },
        }}
      >
        {selectedStation && (() => {
          const statusInfo = getStatusColor(selectedStation.status);
          const isScheduled = isStationScheduled(selectedStation.stationCode);

          return (
            <>
              <DialogTitle
                sx={{
                  p: 3,
                  pb: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Chip
                      size="small"
                      label={selectedStation.stationCode}
                      sx={{
                        fontWeight: 800,
                        fontFamily: "monospace",
                        backgroundColor: "#d1fae5",
                        color: "#065f46",
                      }}
                    />
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                      {selectedStation.sensorType}
                    </Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", mt: 0.5 }}>
                    {selectedStation.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748b", fontFamily: "monospace", display: "block", mt: 0.25 }}>
                    GPS: {selectedStation.latitude.toFixed(4)}°N, {selectedStation.longitude.toFixed(4)}°E
                  </Typography>
                </Box>

                <IconButton onClick={() => setSelectedStation(null)} sx={{ color: "#64748b" }}>
                  <CloseRoundedIcon />
                </IconButton>
              </DialogTitle>

              <DialogContent sx={{ p: 3, pt: 1 }}>
                {/* Top Banner Alert */}
                <Box
                  sx={{
                    p: 2.2,
                    mb: 3,
                    borderRadius: 3,
                    border: `1px solid ${statusInfo.border}`,
                    backgroundColor: statusInfo.bg,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(0,0,0,0.05)",
                      color: statusInfo.main,
                    }}
                  >
                    <EngineeringRoundedIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: statusInfo.textPrimary }}>
                      {selectedStation.primaryRiskFactor}
                    </Typography>
                    <Typography variant="body2" sx={{ color: statusInfo.textSecondary, fontSize: "0.85rem", mt: 0.25 }}>
                      {selectedStation.recommendedAction}
                    </Typography>
                  </Box>
                </Box>

                {/* RUL & Health Details */}
                <Typography variant="overline" sx={{ color: "#64748b", fontWeight: 800, display: "block", mb: 1.5, letterSpacing: "0.08em" }}>
                  Machine Learning Prognostic Indicators
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 2, borderRadius: 2.5, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <Typography variant="caption" sx={{ color: "#64748b", display: "block", fontWeight: 600 }}>
                        Estimated RUL
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", mt: 0.5 }}>
                        ~{selectedStation.estimatedDaysToService} Days
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 2, borderRadius: 2.5, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <Typography variant="caption" sx={{ color: "#64748b", display: "block", fontWeight: 600 }}>
                        Signal Jitter
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", mt: 0.5 }}>
                        {selectedStation.metrics.signalJitter}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 2, borderRadius: 2.5, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <Typography variant="caption" sx={{ color: "#64748b", display: "block", fontWeight: 600 }}>
                        Zero Drift
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", mt: 0.5 }}>
                        {selectedStation.metrics.driftPct > 0 ? `+${selectedStation.metrics.driftPct}%` : `${selectedStation.metrics.driftPct}%`}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Box sx={{ p: 2, borderRadius: 2.5, backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <Typography variant="caption" sx={{ color: "#64748b", display: "block", fontWeight: 600 }}>
                        Telemetry Uptime
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", mt: 0.5 }}>
                        {selectedStation.metrics.uptimePct}%
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Field Technician Work Order Steps */}
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0f172a", mb: 1.5 }}>
                    Recommended Technician Field Checklist
                  </Typography>

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <CheckCircleRoundedIcon sx={{ color: "#10b981", fontSize: 20, mt: 0.2 }} />
                      <Typography variant="body2" sx={{ color: "#334155", fontWeight: 500 }}>
                        1. Inspect physical housing, LoRaWAN / 4G antenna, and solar collector panels for grime or shading.
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <CheckCircleRoundedIcon sx={{ color: "#10b981", fontSize: 20, mt: 0.2 }} />
                      <Typography variant="body2" sx={{ color: "#334155", fontWeight: 500 }}>
                        2. Clean optical particulate scattering cavity with compressed dry nitrogen / air purge and wipe exterior lens.
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <CheckCircleRoundedIcon sx={{ color: "#10b981", fontSize: 20, mt: 0.2 }} />
                      <Typography variant="body2" sx={{ color: "#334155", fontWeight: 500 }}>
                        3. Perform certified zero-gas baseline check; record post-calibration residual offset in municipal registry.
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </DialogContent>

              <DialogActions sx={{ p: 3, pt: 1, gap: 1.5 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={() => setSensorToRemove(selectedStation)}
                  sx={{
                    borderRadius: 2.5,
                    px: 2,
                    py: 1,
                    textTransform: "none",
                    fontWeight: 700,
                    borderColor: "#fca5a5",
                    color: "#dc2626",
                    mr: "auto",
                    "&:hover": {
                      backgroundColor: "#fee2e2",
                      borderColor: "#ef4444",
                    },
                  }}
                >
                  Decommission Sensor
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setSelectedStation(null)}
                  sx={{
                    borderRadius: 2.5,
                    px: 3,
                    py: 1,
                    textTransform: "none",
                    fontWeight: 700,
                    borderColor: "#cbd5e1",
                    color: "#334155",
                    backgroundColor: "#ffffff",
                    "&:hover": {
                      backgroundColor: "#f1f5f9",
                      borderColor: "#94a3b8",
                    },
                  }}
                >
                  Close
                </Button>
                {isScheduled ? (
                  <Button
                    component={Link}
                    to="/maintenance-schedule"
                    variant="contained"
                    sx={{
                      borderRadius: 2.5,
                      px: 3,
                      py: 1,
                      textTransform: "none",
                      fontWeight: 800,
                      backgroundColor: "#d1fae5",
                      color: "#065f46",
                      border: "1px solid #a7f3d0",
                      boxShadow: "none",
                      "&:hover": {
                        backgroundColor: "#bbf7d0",
                      },
                    }}
                  >
                    View in Schedule
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={async () => {
                      await handleScheduleOrder(selectedStation);
                      setSelectedStation(null);
                    }}
                    sx={{
                      borderRadius: 2.5,
                      px: 3,
                      py: 1,
                      textTransform: "none",
                      fontWeight: 800,
                      backgroundColor: "#00dc82",
                      color: "#0b1329",
                      boxShadow: "none",
                      "&:hover": {
                        backgroundColor: "#00c474",
                        boxShadow: "none",
                      },
                    }}
                  >
                    Dispatch Work Order
                  </Button>
                )}
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* Register New Fleet Sensor Dialog */}
      <Dialog
        open={isAddSensorOpen}
        onClose={() => !isSubmittingSensor && setIsAddSensorOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 4,
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            },
          },
        }}
      >
        <Box
          component="form"
          onSubmit={handleAddSensorSubmit}
        >
          {/* Modal Header */}
          <DialogTitle
            sx={{
              p: 3,
              pb: 2,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.5,
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#059669",
                }}
              >
                <SensorsRoundedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a" }}>
                  Register New Fleet Sensor
                </Typography>
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>
                  Enroll a new IoT environmental sensing station into Debrecen real-time monitoring
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => setIsAddSensorOpen(false)}
              disabled={isSubmittingSensor}
              size="small"
              sx={{ color: "#64748b" }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </DialogTitle>

          {/* Modal Body */}
          <DialogContent sx={{ p: 3, pt: 3 }}>
            {addSensorError && (
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5 }}>
                {addSensorError}
              </Alert>
            )}

            <Grid container spacing={2.5}>
              {/* Station Code */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155", mb: 0.75, display: "block" }}>
                  Station Code *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={sensorCode}
                  onChange={(e) => setSensorCode(e.target.value)}
                  placeholder="e.g. ST-AIR-08"
                  required
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2.5,
                      backgroundColor: "#f8fafc",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#00dc82" },
                    },
                    "& input": { color: "#0f172a", fontWeight: 600, fontSize: "0.9rem" },
                  }}
                />
              </Grid>

              {/* Domain Category */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155", mb: 0.75, display: "block" }}>
                  Environmental Category *
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={sensorCategory}
                  onChange={(e) => handleCategoryChange(e.target.value as "AIR" | "NOISE" | "WATER")}
                  sx={{
                    borderRadius: 2.5,
                    backgroundColor: "#f8fafc",
                    "& fieldset": { borderColor: "#cbd5e1" },
                    "&:hover fieldset": { borderColor: "#94a3b8" },
                    "&.Mui-focused fieldset": { borderColor: "#00dc82" },
                    "& .MuiSelect-select": { color: "#0f172a", fontWeight: 600, fontSize: "0.9rem" },
                  }}
                >
                  <MenuItem value="AIR" sx={{ color: "#0f172a", fontWeight: 600 }}>
                    Air Quality Monitoring (PM2.5 / PM10 / NO2)
                  </MenuItem>
                  <MenuItem value="NOISE" sx={{ color: "#0f172a", fontWeight: 600 }}>
                    Acoustic Decibel Monitoring (dBA)
                  </MenuItem>
                  <MenuItem value="WATER" sx={{ color: "#0f172a", fontWeight: 600 }}>
                    Hydrological & Water Quality (pH / DO)
                  </MenuItem>
                </Select>
              </Grid>

              {/* Station Name */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155", mb: 0.75, display: "block" }}>
                  Location / Station Name *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={sensorName}
                  onChange={(e) => setSensorName(e.target.value)}
                  placeholder="e.g. Debrecen Innovation Hub Node"
                  required
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2.5,
                      backgroundColor: "#f8fafc",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#00dc82" },
                    },
                    "& input": { color: "#0f172a", fontWeight: 600, fontSize: "0.9rem" },
                  }}
                />
              </Grid>

              {/* Telemetry Hardware Model */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155", mb: 0.75, display: "block" }}>
                  Telemetry Hardware Sensor Model
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={sensorType}
                  onChange={(e) => setSensorType(e.target.value)}
                  placeholder="e.g. Laser Optical Particle Counter (PM2.5 / PM10)"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2.5,
                      backgroundColor: "#f8fafc",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#00dc82" },
                    },
                    "& input": { color: "#0f172a", fontWeight: 600, fontSize: "0.9rem" },
                  }}
                />
              </Grid>

              {/* GPS Coordinates */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155", mb: 0.75, display: "block" }}>
                  Latitude (°N) *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={sensorLat}
                  onChange={(e) => setSensorLat(e.target.value)}
                  placeholder="47.5316"
                  required
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2.5,
                      backgroundColor: "#f8fafc",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#00dc82" },
                    },
                    "& input": { color: "#0f172a", fontWeight: 600, fontSize: "0.9rem" },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155", mb: 0.75, display: "block" }}>
                  Longitude (°E) *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={sensorLng}
                  onChange={(e) => setSensorLng(e.target.value)}
                  placeholder="21.6273"
                  required
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2.5,
                      backgroundColor: "#f8fafc",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#00dc82" },
                    },
                    "& input": { color: "#0f172a", fontWeight: 600, fontSize: "0.9rem" },
                  }}
                />
              </Grid>

              {/* Initial Calibration & RUL */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155", mb: 0.75, display: "block" }}>
                  Initial Health Score (%)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={sensorHealth}
                  onChange={(e) => setSensorHealth(e.target.value)}
                  slotProps={{ htmlInput: { min: 10, max: 100 } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2.5,
                      backgroundColor: "#f8fafc",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#00dc82" },
                    },
                    "& input": { color: "#0f172a", fontWeight: 600, fontSize: "0.9rem" },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155", mb: 0.75, display: "block" }}>
                  Estimated Days to Next Service
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={sensorDays}
                  onChange={(e) => setSensorDays(e.target.value)}
                  slotProps={{ htmlInput: { min: 1, max: 365 } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2.5,
                      backgroundColor: "#f8fafc",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#00dc82" },
                    },
                    "& input": { color: "#0f172a", fontWeight: 600, fontSize: "0.9rem" },
                  }}
                />
              </Grid>
            </Grid>

            {/* Informational Callout */}
            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: 2.5,
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
              }}
            >
              <CheckCircleRoundedIcon sx={{ color: "#059669", fontSize: 20, mt: 0.2 }} />
              <Typography variant="caption" sx={{ color: "#166534", fontWeight: 600, lineHeight: 1.5 }}>
                New sensor stations automatically calibrate with 100% uptime baseline and nominal signal jitter.
                Weibull AFT prognostic models will immediately evaluate the station and integrate it into predictive maintenance schedules.
              </Typography>
            </Box>
          </DialogContent>

          {/* Modal Actions */}
          <DialogActions sx={{ p: 3, pt: 1, gap: 1.5, borderTop: "1px solid #e2e8f0" }}>
            <Button
              variant="outlined"
              onClick={() => setIsAddSensorOpen(false)}
              disabled={isSubmittingSensor}
              sx={{
                borderRadius: 2.5,
                px: 3,
                py: 1,
                textTransform: "none",
                fontWeight: 700,
                borderColor: "#cbd5e1",
                color: "#334155",
                backgroundColor: "#ffffff",
                "&:hover": {
                  backgroundColor: "#f1f5f9",
                  borderColor: "#94a3b8",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmittingSensor}
              startIcon={isSubmittingSensor ? <CircularProgress size={18} sx={{ color: "#0b1329" }} /> : <AddRoundedIcon />}
              sx={{
                borderRadius: 2.5,
                px: 3.5,
                py: 1,
                textTransform: "none",
                fontWeight: 800,
                backgroundColor: "#00dc82",
                color: "#0b1329",
                boxShadow: "0 2px 10px rgba(0, 220, 130, 0.25)",
                "&:hover": {
                  backgroundColor: "#00c474",
                  boxShadow: "0 4px 14px rgba(0, 220, 130, 0.35)",
                },
              }}
            >
              {isSubmittingSensor ? "Registering Sensor..." : "Register Sensor"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Sensor Decommissioning Confirmation Dialog */}
      <Dialog
        open={Boolean(sensorToRemove)}
        onClose={() => !isRemovingSensor && setSensorToRemove(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3.5,
              p: 1,
              backgroundColor: isMidnight ? "#0f172a" : "#ffffff",
              color: tokens.textPrimary,
              border: `1px solid ${isMidnight ? "rgba(239, 68, 68, 0.3)" : "#fecaca"}`,
              boxShadow: "0 20px 45px rgba(0,0,0,0.35)",
            },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ef4444",
            }}
          >
            <DeleteOutlineRoundedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: "1.1rem" }}>
              Decommission Sensor
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>
              Station Removal & Archive
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {removeError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {removeError}
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: tokens.textSecondary, mb: 2 }}>
            Are you sure you want to decommission{" "}
            <strong style={{ color: tokens.textPrimary }}>
              {sensorToRemove?.stationCode} ({sensorToRemove?.name})
            </strong>
            ?
          </Typography>

          <Box
            sx={{
              p: 2,
              borderRadius: 2.5,
              backgroundColor: isMidnight ? "rgba(239, 68, 68, 0.08)" : "#fef2f2",
              border: `1px solid ${isMidnight ? "rgba(239, 68, 68, 0.2)" : "#fee2e2"}`,
            }}
          >
            <Typography variant="caption" sx={{ color: "#dc2626", fontWeight: 700, display: "block", mb: 0.5 }}>
              Notice:
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.textSecondary, display: "block", lineHeight: 1.5 }}>
              This sensor will be permanently purged from active telemetry streams, health diagnostics, and predictive dispatch queues.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setSensorToRemove(null)}
            disabled={isRemovingSensor}
            variant="outlined"
            sx={{
              borderRadius: 2.5,
              px: 2.5,
              textTransform: "none",
              fontWeight: 700,
              borderColor: tokens.cardBorder,
              color: tokens.textSecondary,
              "&:hover": {
                borderColor: tokens.textMuted,
                backgroundColor: isMidnight ? "rgba(255,255,255,0.05)" : "#f1f5f9",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmRemoveSensor}
            disabled={isRemovingSensor}
            variant="contained"
            color="error"
            startIcon={isRemovingSensor ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <DeleteOutlineRoundedIcon />}
            sx={{
              borderRadius: 2.5,
              px: 3,
              textTransform: "none",
              fontWeight: 800,
              backgroundColor: "#dc2626",
              "&:hover": {
                backgroundColor: "#b91c1c",
              },
            }}
          >
            {isRemovingSensor ? "Decommissioning..." : "Confirm Decommission"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Notification Snackbar */}
      <Snackbar
        open={Boolean(removeNotification)}
        autoHideDuration={5000}
        onClose={() => setRemoveNotification(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setRemoveNotification(null)}
          severity="success"
          variant="filled"
          sx={{
            width: "100%",
            borderRadius: 2.5,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {removeNotification}
        </Alert>
      </Snackbar>
    </Box>
  );
}
