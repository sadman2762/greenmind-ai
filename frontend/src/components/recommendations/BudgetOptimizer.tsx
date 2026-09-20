import { useEffect, useMemo, useState, useTransition } from "react";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import AddIcon from "@mui/icons-material/Add";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DirectionsTransitFilledIcon from "@mui/icons-material/DirectionsTransitFilled";
import DownloadIcon from "@mui/icons-material/Download";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import RemoveIcon from "@mui/icons-material/Remove";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SendIcon from "@mui/icons-material/Send";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SensorsOutlinedIcon from "@mui/icons-material/SensorsOutlined";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Snackbar,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { useSimulation } from "../../context/SimulationContext";
import { getRecommendations, optimizeBudget } from "../../services/recommendationService";
import type { SensorRecommendation } from "../../types/recommendation";
import {
  PLANNING_PACKAGES,
  TIER_CONFIGS,
  type BudgetOptimizationResult,
  type BudgetPlanningPackage,
  type CustomTierSpecs,
  type OptimizationConstraints,
  type OptimizationStrategy,
  type OptimizedStation,
  type PortfolioTradeoffComparison,
  type SensorTier,
  type TierConfig,
} from "../../types/budget";

const BUDGET_PRESETS = [
  { label: "€25k Pilot", value: 25000 },
  { label: "€50k Standard", value: 50000 },
  { label: "€100k Expansion", value: 100000 },
  { label: "€200k Citywide", value: 200000 },
];

const STRATEGIES: {
  id: OptimizationStrategy;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "balanced",
    label: "Balanced Hybrid",
    description:
      "Golden ratio: 1-2 regulatory reference anchors + mid-tier transport sentinels + suburban IoT mesh.",
    icon: <TuneIcon fontSize="small" />,
  },
  {
    id: "coverage",
    label: "Max Coverage (Mesh)",
    description:
      "Maximizes geographical footprint, deploying dense low-cost IoT nodes across all school and neighborhood blind spots.",
    icon: <GridViewOutlinedIcon fontSize="small" />,
  },
  {
    id: "precision",
    label: "High Precision (Regulatory)",
    description:
      "Prioritizes certified EN reference stations for legal compliance, statutory reporting, and baseline calibration.",
    icon: <PrecisionManufacturingIcon fontSize="small" />,
  },
  {
    id: "traffic",
    label: "Transit Corridors",
    description:
      "Prioritizes high-frequency DKV transport stops and major commuter thoroughfares.",
    icon: <DirectionsTransitFilledIcon fontSize="small" />,
  },
];

export default function BudgetOptimizer() {
  const [budget, setBudget] = useState<number>(50000);
  const [strategy, setStrategy] = useState<OptimizationStrategy>("balanced");
  const [result, setResult] = useState<BudgetOptimizationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isDeployed, setIsDeployed] = useState<boolean>(false);

  // Directly editable string inputs for hardware tier cards
  const [tierInputValues, setTierInputValues] = useState<Record<SensorTier, string>>({
    reference: "0",
    micro: "0",
    iot: "0",
  });

  // Keep direct string inputs in sync whenever optimization result or tier counts update
  useEffect(() => {
    if (result?.tierCounts) {
      setTierInputValues({
        reference: String(result.tierCounts.reference ?? 0),
        micro: String(result.tierCounts.micro ?? 0),
        iot: String(result.tierCounts.iot ?? 0),
      });
    }
  }, [result?.tierCounts]);

  // Custom hardware tier values (unit costs, O&M, radius)
  const [customTierSpecs, setCustomTierSpecs] = useState<CustomTierSpecs>({
    reference: {
      unitCost: TIER_CONFIGS.reference.unitCost,
      annualOm: TIER_CONFIGS.reference.annualOm,
      radiusKm: TIER_CONFIGS.reference.radiusKm,
    },
    micro: {
      unitCost: TIER_CONFIGS.micro.unitCost,
      annualOm: TIER_CONFIGS.micro.annualOm,
      radiusKm: TIER_CONFIGS.micro.radiusKm,
    },
    iot: {
      unitCost: TIER_CONFIGS.iot.unitCost,
      annualOm: TIER_CONFIGS.iot.annualOm,
      radiusKm: TIER_CONFIGS.iot.radiusKm,
    },
  });

  // Advanced municipal constraints & planning horizon
  const [includeFiveYearTco, setIncludeFiveYearTco] = useState<boolean>(false);
  const [minReference, setMinReference] = useState<number>(0);
  const [minMicro, setMinMicro] = useState<number>(0);
  const [maxAnnualOm, setMaxAnnualOm] = useState<number | null>(null);
  const [showAdvancedConstraints, setShowAdvancedConstraints] = useState<boolean>(false);

  // Tab mode:
  // 0 = Portfolio Optimizer
  // 1 = AI Planning Suggestions & Packages
  // 2 = Hardware Tier Values Modeler
  // 3 = Low-Cost vs Reference Trade-Off Matrix
  // 4 = Procurement Dossier & Export
  const [activeTab, setActiveTab] = useState<number>(0);

  // Station roster filters & in-memory station overrides (for tier / position edits)
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string>("");

  // Candidate pool for expanding suggested allocations
  const [candidatePool, setCandidatePool] = useState<SensorRecommendation[]>([]);
  const [selectedRosterStation, setSelectedRosterStation] = useState<OptimizedStation | null>(null);

  // Package customized recommended tiers
  const [packageTiers, setPackageTiers] = useState<
    Record<string, { reference: number; micro: number; iot: number }>
  >(() => {
    const initial: Record<string, { reference: number; micro: number; iot: number }> = {};
    PLANNING_PACKAGES.forEach((p) => {
      initial[p.id] = { ...p.recommendedTiers };
    });
    return initial;
  });

  useEffect(() => {
    let active = true;
    getRecommendations()
      .then((recs) => {
        if (active) setCandidatePool(recs);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [, startTransition] = useTransition();
  const {
    deployOptimizedPlan,
    clearSimulation,
    simulatedStations,
    updateStationTier,
  } = useSimulation();

  useEffect(() => {
    let isCancelled = false;

    const debounceTimer = setTimeout(async () => {
      setLoading(true);
      setError("");

      // Filter to only custom manually-placed user pins so previous AI deployments
      // do not distort clean re-optimizations
      const customPinsOnly = simulatedStations.filter((s) => s.isCustom);

      const constraints: OptimizationConstraints = {
        minReference,
        minMicro,
        maxAnnualOm,
        includeFiveYearTco,
        customTierSpecs,
      };

      try {
        const data = await optimizeBudget(
          budget,
          strategy,
          customPinsOnly,
          constraints,
        );
        if (!isCancelled) {
          startTransition(() => {
            setResult(data);
            if (data.allocatedStations && data.allocatedStations.length > 0) {
              setCandidatePool((prev) => {
                const existingMap = new Map(prev.map((c) => [c.id, c]));
                data.allocatedStations.forEach((st) => {
                  if (!existingMap.has(st.id)) {
                    existingMap.set(st.id, st);
                  }
                });
                return Array.from(existingMap.values());
              });
            }
          });
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to run optimization.",
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      isCancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [budget, strategy, minReference, minMicro, maxAnnualOm, includeFiveYearTco, customTierSpecs]);

  function handleDeploy() {
    if (!result || result.allocatedStations.length === 0) return;
    deployOptimizedPlan(result.allocatedStations);
    setIsDeployed(true);
    setToastMessage(`Deployed ${result.totalStations} stations to map! You can drag any marker on the map to reposition it.`);
  }

  function handleClear() {
    clearSimulation();
    setIsDeployed(false);
    setToastMessage("Simulation stations cleared from map.");
  }

  function handleApplyPackageSuggestion(pkg: BudgetPlanningPackage) {
    setBudget(pkg.budget);
    setStrategy(pkg.strategy);
    if (pkg.customSpecs) {
      setCustomTierSpecs((prev) => ({ ...prev, ...pkg.customSpecs }));
    }
    const currentPkgTiers = packageTiers[pkg.id] || pkg.recommendedTiers;
    setMinReference(currentPkgTiers.reference || 0);
    setMinMicro(currentPkgTiers.micro || 0);
    setActiveTab(0);
    setToastMessage(
      `Applied package: "${pkg.title}" (€${pkg.budget.toLocaleString()}). Configured ${currentPkgTiers.reference} Ref, ${currentPkgTiers.micro} Micro, ${currentPkgTiers.iot} IoT. Recalculating...`,
    );
  }

  function handlePackageTierChange(
    pkgId: string,
    tier: SensorTier,
    delta: number,
  ) {
    setPackageTiers((prev) => {
      const current = prev[pkgId] || { reference: 0, micro: 0, iot: 0 };
      const currentVal = current[tier] || 0;
      const nextVal = Math.max(0, currentVal + delta);
      return {
        ...prev,
        [pkgId]: {
          ...current,
          [tier]: nextVal,
        },
      };
    });
  }

  function handlePackageTierSet(
    pkgId: string,
    tier: SensorTier,
    targetCount: number,
  ) {
    setPackageTiers((prev) => {
      const current = prev[pkgId] || { reference: 0, micro: 0, iot: 0 };
      const nextVal = Math.max(0, Math.floor(targetCount));
      return {
        ...prev,
        [pkgId]: {
          ...current,
          [tier]: nextVal,
        },
      };
    });
  }

  function handleApplyComparisonPathway(comp: PortfolioTradeoffComparison) {
    setStrategy(comp.strategy);
    setActiveTab(0);
    setToastMessage(`Switched strategy to "${comp.name}". Recalculating...`);
  }

  // Update a tier parameter in custom specs
  function handleUpdateTierParam(
    tier: SensorTier,
    param: "unitCost" | "annualOm" | "radiusKm",
    value: number,
  ) {
    setCustomTierSpecs((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [param]: value,
      },
    }));
  }

  // Reset tier parameters to defaults
  function handleResetTierDefaults() {
    setCustomTierSpecs({
      reference: {
        unitCost: TIER_CONFIGS.reference.unitCost,
        annualOm: TIER_CONFIGS.reference.annualOm,
        radiusKm: TIER_CONFIGS.reference.radiusKm,
      },
      micro: {
        unitCost: TIER_CONFIGS.micro.unitCost,
        annualOm: TIER_CONFIGS.micro.annualOm,
        radiusKm: TIER_CONFIGS.micro.radiusKm,
      },
      iot: {
        unitCost: TIER_CONFIGS.iot.unitCost,
        annualOm: TIER_CONFIGS.iot.annualOm,
        radiusKm: TIER_CONFIGS.iot.radiusKm,
      },
    });
    setToastMessage("Hardware tier costs and radii reset to factory defaults.");
  }

  // In-roster tier switch for an individual station
  function handleStationTierChange(stationId: number, newTier: SensorTier) {
    if (!result) return;
    const tierConfig: TierConfig = {
      ...TIER_CONFIGS[newTier],
      unitCost: customTierSpecs[newTier]?.unitCost ?? TIER_CONFIGS[newTier].unitCost,
      annualOm: customTierSpecs[newTier]?.annualOm ?? TIER_CONFIGS[newTier].annualOm,
      radiusKm: customTierSpecs[newTier]?.radiusKm ?? TIER_CONFIGS[newTier].radiusKm,
    };

    // Update locally in result
    setResult((prev) => {
      if (!prev) return prev;
      const updatedStations = prev.allocatedStations.map((st) => {
        if (st.id !== stationId) return st;
        return {
          ...st,
          sensorTier: newTier,
          tierName: tierConfig.name,
          tierBadge: tierConfig.badge,
          unitCost: tierConfig.unitCost,
          annualOm: tierConfig.annualOm,
          effectiveRadiusKm: tierConfig.radiusKm,
          confidenceRating: tierConfig.confidence,
        };
      });

      const newSpent = updatedStations.reduce((sum, s) => sum + s.unitCost, 0);
      const newOm = updatedStations.reduce((sum, s) => sum + s.annualOm, 0);

      const refCount = updatedStations.filter((s) => s.sensorTier === "reference").length;
      const microCount = updatedStations.filter((s) => s.sensorTier === "micro").length;
      const iotCount = updatedStations.filter((s) => s.sensorTier === "iot").length;

      return {
        ...prev,
        allocatedStations: updatedStations,
        allocatedSpend: newSpent,
        remainingBudget: Math.max(0, prev.totalBudget - newSpent),
        budgetUtilizationPercent: roundNum((newSpent / prev.totalBudget) * 100),
        estimatedAnnualOm: newOm,
        fiveYearTco: newSpent + 5 * newOm,
        tierCounts: { reference: refCount, micro: microCount, iot: iotCount },
      };
    });

    // Also update in simulation context if live
    updateStationTier(stationId, newTier, tierConfig);
    setToastMessage(`Station #${stationId} converted to ${tierConfig.name}.`);
  }

  // Synchronize and recompute result whenever suggested allocation is adjusted
  function applyUpdatedStations(
    updatedStations: OptimizedStation[],
    message?: string,
  ) {
    if (!result) return;
    const newSpent = updatedStations.reduce((sum, s) => sum + s.unitCost, 0);
    const newOm = updatedStations.reduce((sum, s) => sum + s.annualOm, 0);

    const refCount = updatedStations.filter((s) => s.sensorTier === "reference").length;
    const microCount = updatedStations.filter((s) => s.sensorTier === "micro").length;
    const iotCount = updatedStations.filter((s) => s.sensorTier === "iot").length;

    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        allocatedStations: updatedStations,
        allocatedSpend: newSpent,
        remainingBudget: Math.max(0, prev.totalBudget - newSpent),
        budgetUtilizationPercent: roundNum((newSpent / prev.totalBudget) * 100),
        estimatedAnnualOm: newOm,
        fiveYearTco: newSpent + 5 * newOm,
        totalStations: updatedStations.length,
        tierCounts: { reference: refCount, micro: microCount, iot: iotCount },
      };
    });

    if (isDeployed || simulatedStations.some((s) => !s.isCustom)) {
      deployOptimizedPlan(updatedStations);
    }

    if (message) {
      setToastMessage(message);
    }
  }

  // Directly set quantity of suggested stations for a specific tier to any number
  function handleSetTierCount(tier: SensorTier, targetCount: number) {
    if (!result) return;
    const clampedTarget = Math.max(0, Math.min(150, Math.floor(targetCount)));
    const stationsInTier = result.allocatedStations.filter(
      (s) => s.sensorTier === tier,
    );
    const currentCount = stationsInTier.length;

    if (clampedTarget === currentCount) return;

    if (clampedTarget < currentCount) {
      // Remove (currentCount - clampedTarget) stations, starting from lowest priority
      const removeCount = currentCount - clampedTarget;
      const sortedByPriority = [...stationsInTier].sort(
        (a, b) => a.priorityScore - b.priorityScore,
      );
      const idsToRemove = new Set(
        sortedByPriority.slice(0, removeCount).map((s) => s.id),
      );
      const updatedStations = result.allocatedStations.filter(
        (s) => !idsToRemove.has(s.id),
      );
      applyUpdatedStations(
        updatedStations,
        `Adjusted ${TIER_CONFIGS[tier].name} to ${clampedTarget} units.`,
      );
    } else {
      // Add (clampedTarget - currentCount) stations
      const addCount = clampedTarget - currentCount;
      const config = TIER_CONFIGS[tier];
      const unitCost = customTierSpecs[tier]?.unitCost ?? config.unitCost;
      const annualOm = customTierSpecs[tier]?.annualOm ?? config.annualOm;
      const radiusKm = customTierSpecs[tier]?.radiusKm ?? config.radiusKm;
      const confidenceRating =
        customTierSpecs[tier]?.confidence ?? config.confidence;

      const allocatedIds = new Set(result.allocatedStations.map((s) => s.id));
      const availableCandidates = candidatePool.filter(
        (c) => !allocatedIds.has(c.id),
      );

      const stationsToAdd: OptimizedStation[] = [];
      for (let i = 0; i < addCount; i++) {
        let candidate = availableCandidates[i];
        if (!candidate) {
          const base = result.allocatedStations[0] || candidatePool[0];
          const pseudoId = 9100 + result.allocatedStations.length + i + 1;
          candidate = {
            ...base,
            id: pseudoId,
            lat: 47.5316 + Math.sin(pseudoId * 1.7) * 0.035,
            lng: 21.6273 + Math.cos(pseudoId * 1.7) * 0.045,
            priorityScore: Math.max(40, 78 - i * 2),
            primaryMonitoringNeed: "air",
          };
        }

        stationsToAdd.push({
          ...candidate,
          sensorTier: tier,
          tierName: config.name,
          tierBadge: config.badge,
          unitCost,
          annualOm,
          effectiveRadiusKm: radiusKm,
          confidenceRating,
          placementRationale: `Direct municipal allocation: Assigned ${config.name} for ${candidate.primaryMonitoringNeed || "coverage expansion"}.`,
          tierDescription: config.description,
        });
      }

      const updatedStations = [...result.allocatedStations, ...stationsToAdd];
      applyUpdatedStations(
        updatedStations,
        `Adjusted ${config.name} to ${clampedTarget} units.`,
      );
    }
  }

  // Remove one suggested station from a specific tier (e.g., from 3 meshes to 2 meshes)
  function handleRemoveStationFromTier(tier: SensorTier) {
    if (!result) return;
    const current = result.tierCounts[tier] || 0;
    handleSetTierCount(tier, Math.max(0, current - 1));
  }

  // Add one station to a specific tier in suggestions
  function handleAddStationToTier(tier: SensorTier) {
    if (!result) return;
    const current = result.tierCounts[tier] || 0;
    handleSetTierCount(tier, current + 1);
  }

  // Remove individual station by ID from allocation roster
  function handleRemoveIndividualStation(stationId: number) {
    if (!result) return;
    const target = result.allocatedStations.find((s) => s.id === stationId);
    const updated = result.allocatedStations.filter((s) => s.id !== stationId);
    applyUpdatedStations(
      updated,
      `Removed station #${stationId} (${target?.tierName || "station"}) from allocation roster.`,
    );
  }

  // Helper rounding
  function roundNum(num: number) {
    return Math.round(num * 10) / 10;
  }

  // Filter allocated stations for roster view
  const filteredStations = useMemo(() => {
    if (!result) return [];
    return result.allocatedStations.filter((st) => {
      const matchesTier = tierFilter === "all" || st.sensorTier === tierFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        st.id.toString().includes(q) ||
        st.tierName.toLowerCase().includes(q) ||
        st.primaryMonitoringNeed.toLowerCase().includes(q) ||
        st.placementRationale.toLowerCase().includes(q);
      return matchesTier && matchesSearch;
    });
  }, [result, tierFilter, searchQuery]);

  // Export CSV Handler
  function handleDownloadCsv() {
    if (!result || result.allocatedStations.length === 0) return;
    const headers = [
      "Station ID",
      "Tier",
      "Unit Cost (€)",
      "Annual O&M (€)",
      "5-Year TCO (€)",
      "Latitude",
      "Longitude",
      "Primary Need",
      "Priority Score",
      "Confidence (%)",
      "Placement Rationale",
    ];
    const rows = result.allocatedStations.map((s) => [
      s.id,
      s.tierName,
      s.unitCost,
      s.annualOm,
      s.unitCost + 5 * s.annualOm,
      s.lat.toFixed(5),
      s.lng.toFixed(5),
      s.primaryMonitoringNeed,
      s.priorityScore,
      s.confidenceRating,
      `"${s.placementRationale.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Debrecen_Sensor_Allocation_${strategy}_${budget}EUR.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage("Procurement roster CSV downloaded.");
  }

  // Export JSON Handler
  function handleDownloadJson() {
    if (!result) return;
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(result, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute(
      "download",
      `Debrecen_Sensor_Portfolio_${strategy}_${budget}EUR.json`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage("Technical specification JSON downloaded.");
  }

  // Copy Executive Summary
  function handleCopySummary() {
    if (!result) return;
    const text = `GREENMIND AI - MUNICIPAL SENSOR INVESTMENT DOSSIER
City: Debrecen, Hungary
Capital Budget: €${budget.toLocaleString()}
Selected Strategy: ${strategy.toUpperCase()} (${result.name || "Optimal Hybrid"})
Total Stations Allocated: ${result.totalStations}
- Reference Grade Stations (EN Certified): ${result.tierCounts.reference}
- Mid-Tier Micro-Stations: ${result.tierCounts.micro}
- Low-Cost IoT Mesh Nodes: ${result.tierCounts.iot}

ECONOMIC & LIFECYCLE BREAKDOWN:
- Upfront CapEx Spend: €${result.allocatedSpend.toLocaleString()}
- Annual O&M Maintenance: €${result.estimatedAnnualOm.toLocaleString()}/yr
- 5-Year Total Cost of Ownership (TCO): €${result.fiveYearTco.toLocaleString()}
- Budget Utilization: ${result.budgetUtilizationPercent}%

URBAN & CITIZEN PROTECTION IMPACT:
- Estimated Citywide Coverage Gain: +${result.estimatedCoverageGainPercent}%
- Estimated Population Protected: ~${result.estimatedPopulationCovered.toLocaleString()} citizens
- Cost Per Resident Protected: €${result.costPerResident}/citizen
- Mean Sensor Confidence Score: ${result.meanConfidenceScore}%
- EU Clean Air Directive Compliance Readiness: ${result.regulatoryComplianceScore}/100
- Calibration Anchor Ratio: ${result.calibrationRatio}
`;
    navigator.clipboard.writeText(text);
    setToastMessage("Council briefing summary copied to clipboard!");
  }

  const activeDeployedCount = simulatedStations.filter((s) => !s.isCustom).length;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3.5,
        mb: 3,
        borderColor: "rgba(15, 118, 110, 0.2)",
        backgroundColor: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 118, 110, 0.05)",
        overflow: "hidden",
      }}
    >
      {/* Header Banner */}
      <Box
        sx={{
          p: { xs: 2.5, md: 3 },
          background:
            "linear-gradient(135deg, #064e3b 0%, #0f766e 50%, #115e59 100%)",
          color: "#ffffff",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
          }}
        >
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 28, color: "#5eead4" }} />
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}
              >
                Multi-Tier Sensor Budget Optimizer
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                mt: 0.75,
                color: "#ccfbf1",
                maxWidth: 820,
                lineHeight: 1.55,
              }}
            >
              Simulate realistic municipal capital expenditure allocations across
              certified Reference Grade stations (€28k), Mid-Tier micro-stations
              (€6.5k), and Low-Cost IoT sensor nodes (€1.2k). Fully customize tier
              costs, radii, and drag stations on the map to test new positions.
            </Typography>
          </Box>

          <Chip
            icon={<ShieldOutlinedIcon sx={{ color: "#064e3b !important" }} />}
            label="City Planning Decision-Support"
            sx={{
              backgroundColor: "#99f6e4",
              color: "#0f766e",
              fontWeight: 800,
              fontSize: "0.75rem",
            }}
          />
        </Box>

        {/* Feature Navigation Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mt: 2.5,
            minHeight: 40,
            "& .MuiTabs-indicator": {
              backgroundColor: "#5eead4",
              height: 3,
              borderRadius: 1.5,
            },
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "rgba(255, 255, 255, 0.75)",
              minHeight: 40,
              py: 0.5,
              px: 2,
              "&.Mui-selected": {
                color: "#ffffff",
              },
            },
          }}
        >
          <Tab
            icon={<TuneIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Portfolio Optimizer"
          />
          <Tab
            icon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="AI Planning Packages"
          />
          <Tab
            icon={<HandymanOutlinedIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Tier Hardware Modeler"
          />
          <Tab
            icon={<CompareArrowsIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Low-Cost vs Reference Trade-Off Matrix"
          />
          <Tab
            icon={<AssessmentIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Procurement Dossier & Export"
          />
        </Tabs>
      </Box>

      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* TAB 0: PORTFOLIO OPTIMIZER */}
        {activeTab === 0 && (
          <>
            {/* Quick Suggestion Banner */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 3,
                borderRadius: 2.5,
                backgroundColor: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <AutoAwesomeIcon sx={{ color: "#0f766e" }} />
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 800, color: "#064e3b" }}
                  >
                    AI Municipal Planning Packages Available
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Explore 5 pre-packaged municipal scenarios tailored for schools, industrial zones, and DKV transit hubs.
                  </Typography>
                </Box>
              </Box>

              <Button
                variant="outlined"
                size="small"
                onClick={() => setActiveTab(1)}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  color: "#0f766e",
                  borderColor: "#0f766e",
                  "&:hover": { backgroundColor: "#d1fae5" },
                }}
              >
                Browse 5 Strategic Suggestions
              </Button>
            </Paper>

            {/* Controls: Budget Slider & Strategy Selector */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* Budget Slider & Custom Input */}
              <Grid size={{ xs: 12, lg: 6 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 800, color: "#1e293b" }}
                        >
                          Municipal Capital Budget
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {includeFiveYearTco
                            ? "Optimizing for 5-Year TCO (CapEx + 5-yr O&M)"
                            : "Procurement CapEx only"}
                        </Typography>
                      </Box>

                      <TextField
                        size="small"
                        type="number"
                        value={budget}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val >= 1000 && val <= 500000) setBudget(val);
                        }}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">€</InputAdornment>
                            ),
                          },
                        }}
                        sx={{
                          width: 140,
                          "& .MuiInputBase-input": {
                            fontWeight: 800,
                            fontFamily: "monospace",
                            textAlign: "right",
                            color: "#0f766e",
                          },
                        }}
                      />
                    </Box>

                    <Slider
                      value={budget}
                      min={10000}
                      max={250000}
                      step={5000}
                      onChange={(_, val) => setBudget(val as number)}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(val) => `€${val.toLocaleString()}`}
                      sx={{
                        color: "#0f766e",
                        "& .MuiSlider-thumb": {
                          width: 18,
                          height: 18,
                          "&:hover, &.Mui-focusVisible": {
                            boxShadow: "0 0 0 8px rgba(15, 118, 110, 0.16)",
                          },
                        },
                      }}
                    />

                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mt: -0.5,
                        mb: 2,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Min: €10,000
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Max: €250,000
                      </Typography>
                    </Box>
                  </Box>

                  {/* Presets & Planning Horizon Toggle */}
                  <Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: "#64748b",
                        }}
                      >
                        Quick Budget Presets
                      </Typography>

                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={includeFiveYearTco}
                            onChange={(e) => setIncludeFiveYearTco(e.target.checked)}
                            sx={{
                              "& .MuiSwitch-switchBase.Mui-checked": {
                                color: "#0f766e",
                              },
                              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                backgroundColor: "#0f766e",
                              },
                            }}
                          />
                        }
                        label={
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 700, color: "#334155" }}
                          >
                            5-Yr TCO Horizon
                          </Typography>
                        }
                      />
                    </Box>

                    <ButtonGroup size="small" sx={{ width: "100%" }}>
                      {BUDGET_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          variant={budget === preset.value ? "contained" : "outlined"}
                          onClick={() => setBudget(preset.value)}
                          sx={{
                            flex: 1,
                            textTransform: "none",
                            fontWeight: 700,
                            backgroundColor:
                              budget === preset.value ? "#0f766e" : "transparent",
                            borderColor: "#cbd5e1",
                            color: budget === preset.value ? "#ffffff" : "#475569",
                            "&:hover": {
                              backgroundColor:
                                budget === preset.value ? "#115e59" : "#f1f5f9",
                            },
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </ButtonGroup>
                  </Box>
                </Paper>
              </Grid>

              {/* Strategy Selection & Constraints */}
              <Grid size={{ xs: 12, lg: 6 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    height: "100%",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1.5,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 800, color: "#1e293b" }}
                    >
                      Allocation Strategy
                    </Typography>

                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<HandymanOutlinedIcon />}
                        onClick={() => setActiveTab(2)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          color: "#0f766e",
                        }}
                      >
                        Edit Tier Values
                      </Button>

                      <Button
                        size="small"
                        startIcon={<TuneIcon />}
                        onClick={() => setShowAdvancedConstraints(!showAdvancedConstraints)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          color: "#0f766e",
                        }}
                      >
                        {showAdvancedConstraints
                          ? "Hide Constraints"
                          : "Constraints"}
                      </Button>
                    </Box>
                  </Box>

                  <Grid container spacing={1.25}>
                    {STRATEGIES.map((strat) => {
                      const isSelected = strategy === strat.id;
                      return (
                        <Grid size={{ xs: 12, sm: 6 }} key={strat.id}>
                          <Box
                            onClick={() => setStrategy(strat.id)}
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              cursor: "pointer",
                              border: isSelected
                                ? "2px solid #0f766e"
                                : "1px solid #e2e8f0",
                              backgroundColor: isSelected ? "#ecfdf5" : "#ffffff",
                              transition: "all 0.15s ease",
                              "&:hover": {
                                borderColor: "#0f766e",
                                transform: "translateY(-2px)",
                              },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                color: isSelected ? "#0f766e" : "#334155",
                              }}
                            >
                              {strat.icon}
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 700, fontSize: "0.85rem" }}
                              >
                                {strat.label}
                              </Typography>
                            </Box>
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                mt: 0.5,
                                color: "#64748b",
                                lineHeight: 1.35,
                              }}
                            >
                              {strat.description}
                            </Typography>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>

                  {/* Collapsible Municipal Constraints */}
                  <Collapse in={showAdvancedConstraints}>
                    <Box
                      sx={{
                        mt: 2,
                        p: 1.5,
                        borderRadius: 2,
                        backgroundColor: "#ffffff",
                        border: "1px dashed #cbd5e1",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, color: "#475569", display: "block", mb: 1 }}
                      >
                        Municipal Policy Constraints
                      </Typography>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            Mandatory Reference Anchors
                          </Typography>
                          <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                            <Select
                              value={minReference}
                              onChange={(e) => setMinReference(Number(e.target.value))}
                              sx={{ fontSize: "0.8rem", fontWeight: 700 }}
                            >
                              <MenuItem value={0}>Auto (Optimization Guided)</MenuItem>
                              <MenuItem value={1}>At least 1 Reference Anchor</MenuItem>
                              <MenuItem value={2}>At least 2 Reference Anchors</MenuItem>
                              <MenuItem value={3}>At least 3 Reference Anchors</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            Annual Maintenance Cap (OpEx)
                          </Typography>
                          <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                            <Select
                              value={maxAnnualOm === null ? -1 : maxAnnualOm}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setMaxAnnualOm(val === -1 ? null : val);
                              }}
                              sx={{ fontSize: "0.8rem", fontWeight: 700 }}
                            >
                              <MenuItem value={-1}>No OpEx Cap</MenuItem>
                              <MenuItem value={4000}>Max €4,000 / year</MenuItem>
                              <MenuItem value={8000}>Max €8,000 / year</MenuItem>
                              <MenuItem value={15000}>Max €15,000 / year</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Box>
                  </Collapse>
                </Paper>
              </Grid>
            </Grid>

            {loading && (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <CircularProgress size={32} sx={{ color: "#0f766e", mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Solving multi-tier sensor allocation...
                </Typography>
              </Box>
            )}

            {/* Results Section */}
            {!loading && result && (
              <>
                {/* MILP Optimization Engine Guarantee Banner */}
                <Box
                  sx={{
                    mb: 2.5,
                    p: 1.5,
                    borderRadius: 2.5,
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #86efac",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <VerifiedUserIcon sx={{ color: "#16a34a", fontSize: 24 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#14532d" }}>
                        Mathematical Global Optimum (MILP Active Learning Solver)
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#166534" }}>
                        {result.optimizationEngine || "Mixed-Integer Linear Programming (scipy.optimize.milp)"} · Multi-Choice 0-1 Knapsack
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Chip
                      size="small"
                      label={`Mean Info Gain: ${result.meanInformationGain || 85}%`}
                      sx={{
                        fontWeight: 800,
                        backgroundColor: "#dcfce7",
                        color: "#15803d",
                        border: "1px solid #bbf7d0",
                      }}
                    />
                    <Chip
                      size="small"
                      label="Guaranteed Optimal"
                      sx={{
                        fontWeight: 800,
                        backgroundColor: "#16a34a",
                        color: "#ffffff",
                      }}
                    />
                  </Box>
                </Box>

                {/* Top KPI Metric Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {/* Capex Allocation */}
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        height: "100%",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#065f46", fontWeight: 700 }}>
                        CAPEX ALLOCATION
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 900,
                          color: "#064e3b",
                          mt: 0.5,
                          fontFamily: "monospace",
                        }}
                      >
                        €{result.allocatedSpend.toLocaleString()}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, Math.max(0, result.budgetUtilizationPercent))}
                        sx={{
                          mt: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: "#bbf7d0",
                          "& .MuiLinearProgress-bar": { backgroundColor: "#059669" },
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          mt: 0.5,
                          color: "#047857",
                          fontWeight: 600,
                        }}
                      >
                        {result.budgetUtilizationPercent}% utilized · €
                        {result.remainingBudget.toLocaleString()} buffer
                      </Typography>
                    </Box>
                  </Grid>

                  {/* 5-Year Life Cycle TCO */}
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: "#fef3c7",
                        border: "1px solid #fde68a",
                        height: "100%",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#92400e", fontWeight: 700 }}>
                        5-YEAR LIFECYCLE TCO
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 900,
                          color: "#78350f",
                          mt: 0.5,
                          fontFamily: "monospace",
                        }}
                      >
                        €{result.fiveYearTco.toLocaleString()}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          mt: 1,
                          color: "#b45309",
                          fontWeight: 700,
                        }}
                      >
                        €{result.estimatedAnnualOm.toLocaleString()}/yr O&M
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: "#92400e",
                          fontSize: "0.7rem",
                        }}
                      >
                        CapEx + 5 Years Maintenance
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Station Breakdown */}
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: "#faf5ff",
                        border: "1px solid #e9d5ff",
                        height: "100%",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#6b21a8", fontWeight: 700 }}>
                        NETWORK STATIONS
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 900,
                          color: "#581c87",
                          mt: 0.5,
                          fontFamily: "monospace",
                        }}
                      >
                        {result.totalStations} Nodes
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          mt: 1,
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip
                          size="small"
                          label={`${result.tierCounts.reference} Ref`}
                          sx={{
                            height: 20,
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                          }}
                        />
                        <Chip
                          size="small"
                          label={`${result.tierCounts.micro} Micro`}
                          sx={{
                            height: 20,
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            backgroundColor: "#f3e8ff",
                            color: "#6b21a8",
                          }}
                        />
                        <Chip
                          size="small"
                          label={`${result.tierCounts.iot} IoT`}
                          sx={{
                            height: 20,
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            backgroundColor: "#ccfbf1",
                            color: "#0f766e",
                          }}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  {/* Coverage Gain & Citizens Protected */}
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        height: "100%",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#166534", fontWeight: 700 }}>
                        COVERAGE GAIN
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 900,
                          color: "#14532d",
                          mt: 0.5,
                          fontFamily: "monospace",
                        }}
                      >
                        +{result.estimatedCoverageGainPercent}%
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          mt: 0.5,
                          color: "#15803d",
                          fontWeight: 700,
                        }}
                      >
                        ~{result.estimatedPopulationCovered.toLocaleString()} residents
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: "#166534",
                          fontSize: "0.7rem",
                        }}
                      >
                        €{result.costPerResident} / citizen protected
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Precision & EU Regulatory Compliance */}
                  <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        height: "100%",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#1e40af", fontWeight: 700 }}>
                        REGULATORY READINESS
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 900,
                          color: "#1e3a8a",
                          mt: 0.5,
                          fontFamily: "monospace",
                        }}
                      >
                        {result.regulatoryComplianceScore}/100
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          mt: 0.5,
                          color: "#2563eb",
                          fontWeight: 700,
                        }}
                      >
                        {result.meanConfidenceScore}% Mean Conf.
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: "#1e40af",
                          fontSize: "0.7rem",
                        }}
                      >
                        Calibration Ratio: {result.calibrationRatio}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Selected Hardware Tier Allocation Cards with Editable Steppers */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "flex-end" },
                    flexDirection: { xs: "column", sm: "row" },
                    mb: 1.5,
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 800, color: "#1e293b" }}
                    >
                      Current Hardware Allocation (Directly Editable Suggestions)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Need 2 meshes instead of 3? Use the <strong>[-]</strong> and <strong>[+]</strong> buttons below to adjust suggested quantities. The budget, TCO, and live map update immediately.
                    </Typography>
                  </Box>

                  <Chip
                    size="small"
                    icon={<EditLocationAltIcon sx={{ fontSize: "14px !important", color: "#0f766e !important" }} />}
                    label="Editable Suggestions Active"
                    sx={{
                      backgroundColor: "#ccfbf1",
                      color: "#0f766e",
                      fontWeight: 800,
                      fontSize: "0.72rem",
                      border: "1px solid #14b8a6",
                    }}
                  />
                </Box>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {(["reference", "micro", "iot"] as SensorTier[]).map((tierKey) => {
                    const config = TIER_CONFIGS[tierKey];
                    const custom = customTierSpecs[tierKey];
                    const unitCost = custom?.unitCost ?? config.unitCost;
                    const annualOm = custom?.annualOm ?? config.annualOm;
                    const radiusKm = custom?.radiusKm ?? config.radiusKm;
                    const count = result.tierCounts[tierKey] || 0;
                    const subtotal = count * unitCost;

                    return (
                      <Grid size={{ xs: 12, md: 4 }} key={tierKey}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            backgroundColor: config.bgColor,
                            border: `1.5px solid ${config.borderColor}`,
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              boxShadow: `0 4px 16px ${config.color}22`,
                            },
                          }}
                        >
                          <Box>
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                mb: 1.25,
                              }}
                            >
                              <Chip
                                size="small"
                                label={config.badge}
                                sx={{
                                  backgroundColor: config.color,
                                  color: "#ffffff",
                                  fontWeight: 800,
                                  fontSize: "0.72rem",
                                }}
                              />

                              {/* Interactive Stepper: [-] [directly editable quantity] [+] */}
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  backgroundColor: "#ffffff",
                                  px: 0.75,
                                  py: 0.25,
                                  borderRadius: 2,
                                  border: `1.5px solid ${config.borderColor}`,
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                                  "&:focus-within": {
                                    borderColor: config.color,
                                    boxShadow: `0 0 0 2px ${config.color}33`,
                                  },
                                }}
                              >
                                <Tooltip
                                  title={`Remove 1 ${config.name} from suggestions`}
                                  arrow
                                >
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={count <= 0}
                                      onClick={() => handleRemoveStationFromTier(tierKey)}
                                      sx={{
                                        p: 0.5,
                                        color: config.color,
                                        "&:hover": { backgroundColor: `${config.borderColor}25` },
                                        "&.Mui-disabled": { opacity: 0.3 },
                                      }}
                                    >
                                      <RemoveIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>

                                <Box
                                  component="input"
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={tierInputValues[tierKey] ?? String(count)}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const raw = e.target.value;
                                    // Accept only digits or empty string while editing
                                    if (raw === "" || /^\d+$/.test(raw)) {
                                      setTierInputValues((prev) => ({ ...prev, [tierKey]: raw }));
                                      if (raw !== "") {
                                        const parsed = parseInt(raw, 10);
                                        if (!isNaN(parsed) && parsed >= 0) {
                                          handleSetTierCount(tierKey, parsed);
                                        }
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    const currentVal = tierInputValues[tierKey];
                                    if (currentVal === "" || isNaN(parseInt(currentVal, 10))) {
                                      setTierInputValues((prev) => ({ ...prev, [tierKey]: String(count) }));
                                      handleSetTierCount(tierKey, count);
                                    } else {
                                      const parsed = Math.max(0, parseInt(currentVal, 10));
                                      setTierInputValues((prev) => ({ ...prev, [tierKey]: String(parsed) }));
                                      handleSetTierCount(tierKey, parsed);
                                    }
                                  }}
                                  onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                                    e.target.select();
                                  }}
                                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === "Enter") {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  aria-label={`${config.name} quantity`}
                                  title="Click to directly type quantity"
                                  sx={{
                                    width: 44,
                                    minWidth: 36,
                                    textAlign: "center",
                                    fontWeight: 900,
                                    color: config.color,
                                    fontFamily: "monospace",
                                    fontSize: "1.05rem",
                                    border: "none",
                                    outline: "none",
                                    backgroundColor: "transparent",
                                    p: "2px 0",
                                    m: 0,
                                    borderRadius: 1,
                                    transition: "background-color 0.15s ease",
                                    "&:hover": {
                                      backgroundColor: `${config.borderColor}15`,
                                    },
                                    "&:focus": {
                                      backgroundColor: `${config.borderColor}25`,
                                    },
                                    "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
                                      WebkitAppearance: "none",
                                      margin: 0,
                                    },
                                    MozAppearance: "textfield",
                                    cursor: "text",
                                  }}
                                />

                                <Tooltip
                                  title={`Add 1 ${config.name} to suggestions`}
                                  arrow
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => handleAddStationToTier(tierKey)}
                                    sx={{
                                      p: 0.5,
                                      color: config.color,
                                      "&:hover": { backgroundColor: `${config.borderColor}25` },
                                    }}
                                  >
                                    <AddIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>

                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 800, color: "#1e293b" }}
                            >
                              {config.name}
                            </Typography>

                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                color: "text.secondary",
                                mt: 0.5,
                                lineHeight: 1.4,
                              }}
                            >
                              {config.description}
                            </Typography>
                          </Box>

                          <Box sx={{ mt: 1.5 }}>
                            <Divider sx={{ mb: 1.25, borderColor: `${config.borderColor}55` }} />

                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                Unit: €{unitCost.toLocaleString()} · Radius: {radiusKm} km · O&M: €{annualOm}/yr
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 800,
                                  color: config.color,
                                  fontFamily: "monospace",
                                }}
                              >
                                Subtotal: €{subtotal.toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>

                {/* Action Bar: Deploy / Clear Simulation & Map Reposition Guidance */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <SendIcon sx={{ color: "#0f766e" }} />
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 800, color: "#0f172a" }}
                      >
                        Synchronize With City Map (Repositionable Sensors)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Deploy this {result.totalStations}-station multi-tier portfolio to the live map.
                        <strong> You can drag & drop any station marker on the map to test new positions!</strong>
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    {activeDeployedCount > 0 && (
                      <Button
                        variant="outlined"
                        color="inherit"
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={handleClear}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderColor: "#cbd5e1",
                        }}
                      >
                        Clear Simulation
                      </Button>
                    )}

                    <Button
                      variant="contained"
                      size="small"
                      startIcon={
                        isDeployed ? (
                          <CheckCircleIcon />
                        ) : (
                          <AddBusinessIcon />
                        )
                      }
                      onClick={handleDeploy}
                      sx={{
                        textTransform: "none",
                        fontWeight: 800,
                        px: 2.5,
                        backgroundColor: isDeployed ? "#059669" : "#0f766e",
                        "&:hover": {
                          backgroundColor: isDeployed ? "#047857" : "#115e59",
                        },
                      }}
                    >
                      {isDeployed
                        ? `Plan Deployed (${result.totalStations} Stations Live · Draggable on Map)`
                        : `Deploy Plan to Live Map (${result.totalStations} Stations)`}
                    </Button>
                  </Box>
                </Paper>

                {/* Allocated Station Roster Controls & Interactive Table */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 1.5,
                    mb: 1.5,
                  }}
                >
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 800, color: "#1e293b" }}
                    >
                      Allocated Stations Roster ({filteredStations.length} of{" "}
                      {result.allocatedStations.length} Shown)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      You can change any station’s tier directly below or drag markers on the map.
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <TextField
                      size="small"
                      placeholder="Search roster..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      sx={{
                        width: 180,
                        "& .MuiInputBase-input": {
                          fontSize: "0.8rem",
                          py: 0.5,
                        },
                      }}
                    />

                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      {[
                        { label: "All", value: "all" },
                        { label: "Ref", value: "reference" },
                        { label: "Micro", value: "micro" },
                        { label: "IoT", value: "iot" },
                      ].map((t) => (
                        <Chip
                          key={t.value}
                          label={t.label}
                          size="small"
                          clickable
                          onClick={() => setTierFilter(t.value)}
                          sx={{
                            fontWeight: 700,
                            fontSize: "0.72rem",
                            backgroundColor:
                              tierFilter === t.value ? "#0f766e" : "#f1f5f9",
                            color: tierFilter === t.value ? "#ffffff" : "#475569",
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>

                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{
                    borderRadius: 2.5,
                    border: "1px solid #e2e8f0",
                    maxHeight: 380,
                  }}
                >
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                        <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem" }}>
                          Rank / ID
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem" }}>
                          Hardware Classification (Change Tier)
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem" }}>
                          Coordinates (GPS)
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem" }}>
                          Unit CapEx
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem" }}>
                          Annual O&M
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem" }}>
                          Target Need
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: "0.75rem" }}>
                          Placement Rationale
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontWeight: 800, fontSize: "0.75rem" }}
                        >
                          Priority
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{ fontWeight: 800, fontSize: "0.75rem" }}
                        >
                          Action
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {filteredStations.map((station, index) => {
                        const tierConfig = TIER_CONFIGS[station.sensorTier];

                        return (
                          <TableRow
                            key={station.id}
                            hover
                            sx={{
                              "&:last-child td, &:last-child th": { border: 0 },
                            }}
                          >
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.78rem" }}>
                              #{index + 1} ({station.id})
                            </TableCell>

                            {/* Inline Tier Selector */}
                            <TableCell>
                              <Select
                                size="small"
                                value={station.sensorTier}
                                onChange={(e) =>
                                  handleStationTierChange(
                                    station.id,
                                    e.target.value as SensorTier,
                                  )
                                }
                                sx={{
                                  fontSize: "0.75rem",
                                  fontWeight: 800,
                                  height: 28,
                                  backgroundColor: tierConfig.bgColor,
                                  color: tierConfig.color,
                                  "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor: tierConfig.borderColor,
                                  },
                                }}
                              >
                                <MenuItem value="reference" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                                  Tier 1: Reference (€{customTierSpecs.reference?.unitCost ?? 28000})
                                </MenuItem>
                                <MenuItem value="micro" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                                  Tier 2: Micro (€{customTierSpecs.micro?.unitCost ?? 6500})
                                </MenuItem>
                                <MenuItem value="iot" sx={{ fontSize: "0.75rem", fontWeight: 700 }}>
                                  Tier 3: IoT Mesh (€{customTierSpecs.iot?.unitCost ?? 1200})
                                </MenuItem>
                              </Select>
                            </TableCell>

                            <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                <span>{(Number(station.lat) || 0).toFixed(4)}, {(Number(station.lng) || 0).toFixed(4)}</span>
                                <Tooltip title="Draggable on map: Drag this marker on the map to test new positions" arrow>
                                  <EditLocationAltIcon sx={{ fontSize: 16, color: "#0f766e" }} />
                                </Tooltip>
                              </Box>
                            </TableCell>

                            <TableCell
                              sx={{
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                fontFamily: "monospace",
                              }}
                            >
                              €{station.unitCost.toLocaleString()}
                            </TableCell>

                            <TableCell
                              sx={{
                                fontSize: "0.78rem",
                                color: "#64748b",
                                fontFamily: "monospace",
                              }}
                            >
                              €{station.annualOm.toLocaleString()}
                            </TableCell>

                            <TableCell sx={{ textTransform: "capitalize", fontSize: "0.78rem" }}>
                              {station.primaryMonitoringNeed}
                            </TableCell>

                            <TableCell
                              sx={{
                                fontSize: "0.75rem",
                                color: "#475569",
                                maxWidth: 280,
                              }}
                            >
                              <Tooltip title={station.tierDescription} arrow>
                                <span>{station.placementRationale}</span>
                              </Tooltip>
                            </TableCell>

                            <TableCell
                              align="right"
                              sx={{
                                fontWeight: 800,
                                fontSize: "0.78rem",
                                color: "#0f766e",
                              }}
                            >
                              {station.priorityScore}/100
                              {station.informationGainScore !== undefined && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: "block",
                                    color: "#0284c7",
                                    fontWeight: 700,
                                    fontSize: "0.7rem",
                                  }}
                                >
                                  IG: {station.informationGainScore}%
                                </Typography>
                              )}
                            </TableCell>

                            <TableCell align="center">
                              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                                <Tooltip title={`View full sensor details for station #${station.id}`} arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => setSelectedRosterStation(station)}
                                    sx={{
                                      color: "#0f766e",
                                      p: 0.5,
                                      mr: 0.5,
                                      "&:hover": { backgroundColor: "#f0fdfa" },
                                    }}
                                  >
                                    <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>

                                <Tooltip title={`Remove station #${station.id} from suggestions`} arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveIndividualStation(station.id)}
                                    sx={{
                                      color: "#ef4444",
                                      p: 0.5,
                                      "&:hover": { backgroundColor: "#fee2e2" },
                                    }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Selected Roster Station Details Modal */}
                <Dialog
                  open={Boolean(selectedRosterStation)}
                  onClose={() => setSelectedRosterStation(null)}
                  maxWidth="sm"
                  fullWidth
                  slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
                >
                  {selectedRosterStation && (
                    <>
                      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <SensorsOutlinedIcon sx={{ color: "#0f766e" }} />
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Sensor #{selectedRosterStation.id} ({selectedRosterStation.tierName})
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setSelectedRosterStation(null)}>
                          <CloseIcon />
                        </IconButton>
                      </DialogTitle>

                      <DialogContent dividers sx={{ py: 2 }}>
                        <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: "#166534", textTransform: "uppercase" }}>
                            Placement Rationale
                          </Typography>
                          <Typography variant="body2" sx={{ color: "#14532d", fontWeight: 600, mt: 0.25 }}>
                            {selectedRosterStation.placementRationale}
                          </Typography>
                        </Box>

                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <Typography variant="caption" color="text.secondary">Hardware Tier</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: "#0f766e" }}>
                                {selectedRosterStation.tierBadge}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <Typography variant="caption" color="text.secondary">CapEx / Annual O&M</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 800, fontFamily: "monospace" }}>
                                €{selectedRosterStation.unitCost.toLocaleString()} / €{selectedRosterStation.annualOm.toLocaleString()}/yr
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <Typography variant="caption" color="text.secondary">Estimated PM2.5</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {selectedRosterStation.estimatedPm25 != null ? `${Number(selectedRosterStation.estimatedPm25).toFixed(1)} µg/m³` : "5.1 µg/m³"}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <Typography variant="caption" color="text.secondary">Coverage Radius</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {selectedRosterStation.effectiveRadiusKm || 1.5} km
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <Typography variant="caption" color="text.secondary">Coordinates</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, display: "block", fontFamily: "monospace" }}>
                                {(Number(selectedRosterStation.lat) || 0).toFixed(4)}, {(Number(selectedRosterStation.lng) || 0).toFixed(4)}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <Typography variant="caption" color="text.secondary">Nearest Station</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {selectedRosterStation.nearestStation || "Debrecen Active Mesh"}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </DialogContent>

                      <DialogActions sx={{ p: 1.5 }}>
                        <Button onClick={() => setSelectedRosterStation(null)} sx={{ textTransform: "none", fontWeight: 700 }}>
                          Close
                        </Button>
                      </DialogActions>
                    </>
                  )}
                </Dialog>
              </>
            )}
          </>
        )}

        {/* TAB 1: AI STRATEGIC PLANNING PACKAGES & SUGGESTIONS */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 800, color: "#0f172a" }}
              >
                AI Municipal Planning Packages & Curated Suggestions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select from 5 strategic municipal investment blueprints designed for Debrecen’s
                urban topography, vulnerable schools, industrial corridors, and transit routes.
                Clicking any package instantly pre-configures your budget, strategy, and tier composition.
              </Typography>
            </Box>

            <Grid container spacing={2.5}>
              {PLANNING_PACKAGES.map((pkg) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={pkg.id}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        transform: "translateY(-3px)",
                        borderColor: pkg.color,
                        boxShadow: `0 10px 25px ${pkg.color}1a`,
                      },
                    }}
                  >
                    <Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 1.5,
                        }}
                      >
                        <Chip
                          size="small"
                          label={pkg.badge}
                          sx={{
                            backgroundColor: `${pkg.color}18`,
                            color: pkg.color,
                            fontWeight: 800,
                            fontSize: "0.75rem",
                            border: `1px solid ${pkg.color}40`,
                          }}
                        />
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 900,
                            color: pkg.color,
                            fontFamily: "monospace",
                          }}
                        >
                          €{pkg.budget.toLocaleString()}
                        </Typography>
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontSize: 24 }}>{pkg.icon}</Typography>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 800, color: "#1e293b", lineHeight: 1.3 }}
                        >
                          {pkg.title}
                        </Typography>
                      </Box>

                      <Typography
                        variant="caption"
                        sx={{ color: "#64748b", display: "block", mb: 1.5, fontWeight: 600 }}
                      >
                        {pkg.subtitle}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontSize: "0.82rem", lineHeight: 1.45, mb: 2 }}
                      >
                        {pkg.rationale}
                      </Typography>

                      <Divider sx={{ my: 1.5 }} />

                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="caption" color="text.secondary">
                            Strategy:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "capitalize" }}>
                            {pkg.strategy}
                          </Typography>
                        </Box>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="caption" color="text.secondary">
                              Suggested Tiers:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: pkg.color }}>
                              {packageTiers[pkg.id]?.reference ?? pkg.recommendedTiers.reference} Ref · {packageTiers[pkg.id]?.micro ?? pkg.recommendedTiers.micro} Micro · {packageTiers[pkg.id]?.iot ?? pkg.recommendedTiers.iot} IoT
                            </Typography>
                          </Box>

                          {/* Stepper controls to edit package suggested numbers */}
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              px: 1,
                              py: 0.75,
                              borderRadius: 2,
                              backgroundColor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              gap: 0.5,
                            }}
                          >
                            {(["reference", "micro", "iot"] as SensorTier[]).map((tKey) => {
                              const currentCount = packageTiers[pkg.id]?.[tKey] ?? pkg.recommendedTiers[tKey];
                              const tLabel = tKey === "reference" ? "Ref" : tKey === "micro" ? "Micro" : "IoT";
                              const tColor = TIER_CONFIGS[tKey].color;
                              return (
                                <Box key={tKey} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: tColor, fontSize: "0.68rem" }}>
                                    {tLabel}:
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    disabled={currentCount <= 0}
                                    onClick={() => handlePackageTierChange(pkg.id, tKey, -1)}
                                    sx={{ p: 0.25, width: 22, height: 22 }}
                                  >
                                    <RemoveIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                  <Box
                                    component="input"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={currentCount}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                      const raw = e.target.value;
                                      if (raw === "" || /^\d+$/.test(raw)) {
                                        const parsed = parseInt(raw, 10);
                                        handlePackageTierSet(pkg.id, tKey, isNaN(parsed) ? 0 : parsed);
                                      }
                                    }}
                                    onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                      if (e.key === "Enter") {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    aria-label={`${tLabel} count`}
                                    sx={{
                                      fontWeight: 900,
                                      fontSize: "0.82rem",
                                      width: 26,
                                      textAlign: "center",
                                      border: "none",
                                      outline: "none",
                                      backgroundColor: "transparent",
                                      p: 0,
                                      m: 0,
                                      fontFamily: "monospace",
                                      borderRadius: 0.5,
                                      transition: "background-color 0.15s ease",
                                      "&:hover": { backgroundColor: "#e2e8f0" },
                                      "&:focus": { backgroundColor: "#ffffff", boxShadow: `0 0 0 1px ${tColor}` },
                                      "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
                                        WebkitAppearance: "none",
                                        margin: 0,
                                      },
                                      MozAppearance: "textfield",
                                      cursor: "text",
                                    }}
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() => handlePackageTierChange(pkg.id, tKey, 1)}
                                    sx={{ p: 0.25, width: 22, height: 22 }}
                                  >
                                    <AddIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>

                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="caption" color="text.secondary">
                            Target Focus:
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600, maxWidth: 190, textAlign: "right" }}>
                            {pkg.targetFocus}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      onClick={() => handleApplyPackageSuggestion(pkg)}
                      sx={{
                        mt: 2.5,
                        textTransform: "none",
                        fontWeight: 800,
                        backgroundColor: pkg.color,
                        "&:hover": {
                          backgroundColor: pkg.color,
                          filter: "brightness(0.9)",
                        },
                      }}
                    >
                      Apply This Municipal Package
                    </Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* TAB 2: HARDWARE TIER VALUES & SPECS MODELER */}
        {activeTab === 2 && (
          <Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1.5,
                mb: 3,
              }}
            >
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 800, color: "#0f172a" }}
                >
                  Custom Hardware Tier Economics & Values Modeler
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Adjust unit CapEx costs, annual maintenance (O&M), and effective coverage radii
                  for Reference, Mid-Tier Micro, and Low-Cost IoT Mesh nodes. The optimizer
                  recalculates portfolio economics and live map rings in real time.
                </Typography>
              </Box>

              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<RestartAltIcon />}
                onClick={handleResetTierDefaults}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Reset to Factory Defaults
              </Button>
            </Box>

            <Grid container spacing={3}>
              {(["reference", "micro", "iot"] as SensorTier[]).map((tierKey) => {
                const config = TIER_CONFIGS[tierKey];
                const custom = customTierSpecs[tierKey];
                const unitCost = custom?.unitCost ?? config.unitCost;
                const annualOm = custom?.annualOm ?? config.annualOm;
                const radiusKm = custom?.radiusKm ?? config.radiusKm;

                return (
                  <Grid size={{ xs: 12, md: 4 }} key={tierKey}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        backgroundColor: config.bgColor,
                        border: `2px solid ${config.borderColor}`,
                        height: "100%",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 1.5,
                        }}
                      >
                        <Chip
                          size="small"
                          label={config.badge}
                          sx={{
                            backgroundColor: config.color,
                            color: "#ffffff",
                            fontWeight: 800,
                            fontSize: "0.75rem",
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 800, color: config.color }}
                        >
                          Confidence: {config.confidence}%
                        </Typography>
                      </Box>

                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 800, color: "#1e293b", mb: 0.5 }}
                      >
                        {config.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: "block", color: "text.secondary", mb: 2.5, lineHeight: 1.4 }}
                      >
                        {config.description}
                      </Typography>

                      <Divider sx={{ mb: 2, borderColor: `${config.borderColor}55` }} />

                      {/* 1. Unit CapEx Input */}
                      <Box sx={{ mb: 2.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155" }}>
                            Unit Procurement CapEx
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 800, color: config.color, fontFamily: "monospace" }}
                          >
                            €{unitCost.toLocaleString()}
                          </Typography>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={unitCost}
                          onChange={(e) =>
                            handleUpdateTierParam(
                              tierKey,
                              "unitCost",
                              Math.max(100, Number(e.target.value)),
                            )
                          }
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">€</InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            backgroundColor: "#ffffff",
                            "& .MuiInputBase-input": {
                              fontWeight: 700,
                              fontFamily: "monospace",
                            },
                          }}
                        />
                      </Box>

                      {/* 2. Annual O&M Input */}
                      <Box sx={{ mb: 2.5 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155" }}>
                            Annual Maintenance (O&M)
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 800, color: config.color, fontFamily: "monospace" }}
                          >
                            €{annualOm.toLocaleString()}/yr
                          </Typography>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={annualOm}
                          onChange={(e) =>
                            handleUpdateTierParam(
                              tierKey,
                              "annualOm",
                              Math.max(0, Number(e.target.value)),
                            )
                          }
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">€</InputAdornment>
                              ),
                              endAdornment: (
                                <InputAdornment position="end">/year</InputAdornment>
                              ),
                            },
                          }}
                          sx={{
                            backgroundColor: "#ffffff",
                            "& .MuiInputBase-input": {
                              fontWeight: 700,
                              fontFamily: "monospace",
                            },
                          }}
                        />
                      </Box>

                      {/* 3. Coverage Radius Slider */}
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#334155" }}>
                            Coverage Radius (km)
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 800, color: config.color, fontFamily: "monospace" }}
                          >
                            {radiusKm} km
                          </Typography>
                        </Box>
                        <Slider
                          value={radiusKm}
                          min={0.3}
                          max={6.0}
                          step={0.1}
                          onChange={(_, val) =>
                            handleUpdateTierParam(tierKey, "radiusKm", val as number)
                          }
                          valueLabelDisplay="auto"
                          sx={{
                            color: config.color,
                          }}
                        />
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Box sx={{ mt: 3, textAlign: "right" }}>
              <Button
                variant="contained"
                onClick={() => setActiveTab(0)}
                sx={{
                  textTransform: "none",
                  fontWeight: 800,
                  px: 3,
                  backgroundColor: "#0f766e",
                  "&:hover": { backgroundColor: "#115e59" },
                }}
              >
                Apply Values & Return to Optimizer
              </Button>
            </Box>
          </Box>
        )}

        {/* TAB 3: LOW-COST VS REFERENCE TRADE-OFF MATRIX */}
        {activeTab === 3 && result && result.comparisons && (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 800, color: "#0f172a" }}
              >
                Low-Cost vs Reference Station Strategic Trade-Off Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Municipal city council comparative assessment: contrasting pure regulatory
                pathways against hyper-dense low-cost mesh deployments for the allocated
                budget of <strong>€{budget.toLocaleString()}</strong>.
              </Typography>
            </Box>

            <Grid container spacing={2.5}>
              {/* Option A: Pure Regulatory Reference */}
              {(() => {
                const comp = result.comparisons.referenceOnly;
                return (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        backgroundColor: "#fffbeb",
                        border: "2px solid #fde68a",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1.5,
                          }}
                        >
                          <Chip
                            size="small"
                            label="Path A: Pure Regulatory"
                            sx={{
                              backgroundColor: "#b45309",
                              color: "#ffffff",
                              fontWeight: 800,
                              fontSize: "0.75rem",
                            }}
                          />
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 900, color: "#92400e" }}
                          >
                            {comp.totalStations} Stations
                          </Typography>
                        </Box>

                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 800, color: "#78350f" }}
                        >
                          100% Certified Reference
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5, mb: 2, fontSize: "0.82rem" }}
                        >
                          {comp.description}
                        </Typography>

                        <Divider sx={{ my: 1.5, borderColor: "#fde68a" }} />

                        {/* Metrics */}
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Coverage Footprint:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                              +{comp.estimatedCoverageGainPercent}% (High blind spots)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Sensor Confidence:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#059669" }}>
                              {comp.meanConfidenceScore}% (Legal gold standard)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              EU Regulatory Compliance:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#059669" }}>
                              {comp.regulatoryComplianceScore}/100 (Court-admissible)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Annual Maintenance:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#b45309" }}>
                              €{comp.estimatedAnnualOm.toLocaleString()}/yr
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Cost / Resident Protected:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                              €{comp.costPerResident}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        onClick={() => handleApplyComparisonPathway(comp)}
                        sx={{
                          mt: 2.5,
                          textTransform: "none",
                          fontWeight: 700,
                          borderColor: "#d97706",
                          color: "#b45309",
                          "&:hover": {
                            backgroundColor: "#fef3c7",
                            borderColor: "#b45309",
                          },
                        }}
                      >
                        Apply Reference-Only Strategy
                      </Button>
                    </Paper>
                  </Grid>
                );
              })()}

              {/* Option B: Pure Low-Cost IoT Mesh */}
              {(() => {
                const comp = result.comparisons.iotOnly;
                return (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        backgroundColor: "#f0fdfa",
                        border: "2px solid #a7f3d0",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1.5,
                          }}
                        >
                          <Chip
                            size="small"
                            label="Path B: Hyper-Local Mesh"
                            sx={{
                              backgroundColor: "#0f766e",
                              color: "#ffffff",
                              fontWeight: 800,
                              fontSize: "0.75rem",
                            }}
                          />
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 900, color: "#0f766e" }}
                          >
                            {comp.totalStations} Stations
                          </Typography>
                        </Box>

                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 800, color: "#115e59" }}
                        >
                          100% Low-Cost IoT Mesh
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5, mb: 2, fontSize: "0.82rem" }}
                        >
                          {comp.description}
                        </Typography>

                        <Divider sx={{ my: 1.5, borderColor: "#a7f3d0" }} />

                        {/* Metrics */}
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Coverage Footprint:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#059669" }}>
                              +{comp.estimatedCoverageGainPercent}% (Ultra-high density)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Sensor Confidence:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#dc2626" }}>
                              {comp.meanConfidenceScore}% (Uncalibrated drift risk)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              EU Regulatory Compliance:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#dc2626" }}>
                              {comp.regulatoryComplianceScore}/100 (Non-statutory)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Annual Maintenance:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#0f766e" }}>
                              €{comp.estimatedAnnualOm.toLocaleString()}/yr
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Cost / Resident Protected:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                              €{comp.costPerResident}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        onClick={() => handleApplyComparisonPathway(comp)}
                        sx={{
                          mt: 2.5,
                          textTransform: "none",
                          fontWeight: 700,
                          borderColor: "#14b8a6",
                          color: "#0f766e",
                          "&:hover": {
                            backgroundColor: "#ccfbf1",
                            borderColor: "#0f766e",
                          },
                        }}
                      >
                        Apply Pure-Mesh Strategy
                      </Button>
                    </Paper>
                  </Grid>
                );
              })()}

              {/* Option C: AI Optimal Multi-Tier Hybrid */}
              {(() => {
                const comp = result.comparisons.currentHybrid;
                return (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        backgroundColor: "#f5f3ff",
                        border: "2.5px solid #8b5cf6",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        boxShadow: "0 10px 25px rgba(139, 92, 246, 0.12)",
                      }}
                    >
                      <Box>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1.5,
                          }}
                        >
                          <Chip
                            size="small"
                            icon={<VerifiedUserIcon sx={{ color: "#ffffff !important" }} />}
                            label="Path C: AI Multi-Tier Hybrid"
                            sx={{
                              backgroundColor: "#7c3aed",
                              color: "#ffffff",
                              fontWeight: 800,
                              fontSize: "0.75rem",
                            }}
                          />
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 900, color: "#6d28d9" }}
                          >
                            {comp.totalStations} Stations
                          </Typography>
                        </Box>

                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 800, color: "#5b21b6" }}
                        >
                          Optimal Co-Location Portfolio
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5, mb: 2, fontSize: "0.82rem" }}
                        >
                          {comp.description}
                        </Typography>

                        <Divider sx={{ my: 1.5, borderColor: "#ddd6fe" }} />

                        {/* Metrics */}
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Coverage Footprint:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#059669" }}>
                              +{comp.estimatedCoverageGainPercent}% (High citywide reach)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Sensor Confidence:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#059669" }}>
                              {comp.meanConfidenceScore}% (Cross-calibrated)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              EU Regulatory Compliance:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#059669" }}>
                              {comp.regulatoryComplianceScore}/100 (Certified anchor)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Calibration Anchor Ratio:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "#6d28d9" }}>
                              {comp.calibrationRatio} (Ideal EPA/WHO)
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="caption" color="text.secondary">
                              Cost / Resident Protected:
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                              €{comp.costPerResident} (Lowest lifecycle cost)
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        onClick={() => handleApplyComparisonPathway(comp)}
                        sx={{
                          mt: 2.5,
                          textTransform: "none",
                          fontWeight: 800,
                          backgroundColor: "#7c3aed",
                          "&:hover": { backgroundColor: "#6d28d9" },
                        }}
                      >
                        Selected Recommended Portfolio
                      </Button>
                    </Paper>
                  </Grid>
                );
              })()}
            </Grid>
          </Box>
        )}

        {/* TAB 4: PROCUREMENT DOSSIER & RFP EXPORT */}
        {activeTab === 4 && result && (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 800, color: "#0f172a" }}
              >
                Municipal Procurement Dossier & RFP Documentation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Generate and export formal procurement briefs for Debrecen city council,
                environmental committee review, and hardware procurement tenders.
              </Typography>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                backgroundColor: "#f8fafc",
                border: "1px solid #cbd5e1",
                mb: 3,
                fontFamily: "monospace",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1.5,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 800, color: "#0f766e" }}
                >
                  DEBRECEN MUNICIPAL SENSOR ALLOCATION SUMMARY
                </Typography>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={handleCopySummary}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Copy Council Briefing Memo
                </Button>
              </Box>

              <Typography variant="body2" sx={{ lineHeight: 1.7, color: "#1e293b" }}>
                <strong>Total Allocated Capital:</strong> €{result.allocatedSpend.toLocaleString()} of €{budget.toLocaleString()} ({result.budgetUtilizationPercent}% utilized)
                <br />
                <strong>5-Year Lifecycle TCO:</strong> €{result.fiveYearTco.toLocaleString()} (Includes €{result.estimatedAnnualOm.toLocaleString()}/yr maintenance)
                <br />
                <strong>Network Hardware:</strong> {result.totalStations} stations — {result.tierCounts.reference} Tier 1 Reference (€{customTierSpecs.reference?.unitCost ?? 28000}), {result.tierCounts.micro} Tier 2 Micro (€{customTierSpecs.micro?.unitCost ?? 6500}), {result.tierCounts.iot} Tier 3 IoT Mesh (€{customTierSpecs.iot?.unitCost ?? 1200})
                <br />
                <strong>Citizen Impact:</strong> +{result.estimatedCoverageGainPercent}% coverage gain, protecting ~{result.estimatedPopulationCovered.toLocaleString()} residents at €{result.costPerResident}/citizen
                <br />
                <strong>Statutory Compliance:</strong> {result.regulatoryComplianceScore}/100 readiness index (Directive 2008/50/EC alignment)
              </Typography>
            </Paper>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadCsv}
                  sx={{
                    py: 1.5,
                    textTransform: "none",
                    fontWeight: 800,
                    backgroundColor: "#0f766e",
                    "&:hover": { backgroundColor: "#115e59" },
                  }}
                >
                  Download Procurement Roster (CSV)
                </Button>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadJson}
                  sx={{
                    py: 1.5,
                    textTransform: "none",
                    fontWeight: 800,
                    borderColor: "#0f766e",
                    color: "#0f766e",
                    "&:hover": {
                      backgroundColor: "#f0fdfa",
                      borderColor: "#115e59",
                    },
                  }}
                >
                  Download Technical Specification (JSON)
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}
      </CardContent>

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => setToastMessage("")}
        message={toastMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Card>
  );
}
