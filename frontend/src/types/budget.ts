import type { SensorRecommendation } from "./recommendation";

export type SensorTier = "reference" | "micro" | "iot";

export type OptimizationStrategy =
  | "balanced"
  | "coverage"
  | "precision"
  | "traffic";

export interface TierConfig {
  tier: SensorTier;
  name: string;
  badge: string;
  unitCost: number;
  annualOm: number;
  radiusKm: number;
  confidence: number;
  description: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

export const TIER_CONFIGS: Record<SensorTier, TierConfig> = {
  reference: {
    tier: "reference",
    name: "Reference Grade Station",
    badge: "Tier 1: Reference",
    unitCost: 28000,
    annualOm: 3200,
    radiusKm: 3.5,
    confidence: 95,
    description:
      "EN certified regulatory multipollutant station with weather mast and beta-attenuation PM analyzers.",
    color: "#b45309",
    borderColor: "#f59e0b",
    bgColor: "#fffbeb",
  },
  micro: {
    tier: "micro",
    name: "Mid-Tier Micro-Station",
    badge: "Tier 2: Micro",
    unitCost: 6500,
    annualOm: 850,
    radiusKm: 1.8,
    confidence: 82,
    description:
      "Heated optical particle counter + electrochemical gas sensors + acoustic noise microphone.",
    color: "#6b21a8",
    borderColor: "#a855f7",
    bgColor: "#faf5ff",
  },
  iot: {
    tier: "iot",
    name: "Low-Cost IoT Mesh Node",
    badge: "Tier 3: IoT Mesh",
    unitCost: 1200,
    annualOm: 180,
    radiusKm: 0.8,
    confidence: 68,
    description:
      "Laser scattering PM2.5/PM10, temperature/humidity telemetry, solar powered for dense hyper-local grid.",
    color: "#0f766e",
    borderColor: "#14b8a6",
    bgColor: "#f0fdfa",
  },
};

export interface OptimizedStation extends SensorRecommendation {
  sensorTier: SensorTier;
  tierName: string;
  tierBadge: string;
  unitCost: number;
  annualOm: number;
  effectiveRadiusKm: number;
  confidenceRating: number;
  placementRationale: string;
  tierDescription: string;
}

export interface PortfolioTradeoffComparison {
  name: string;
  badge: string;
  description: string;
  strategy: OptimizationStrategy;
  totalBudget: number;
  allocatedSpend: number;
  remainingBudget: number;
  budgetUtilizationPercent: number;
  totalStations: number;
  tierCounts: {
    reference: number;
    micro: number;
    iot: number;
  };
  estimatedAnnualOm: number;
  fiveYearTco: number;
  costPerResident: number;
  costPerKm2: number;
  regulatoryComplianceScore: number;
  calibrationRatio: string;
  estimatedCoverageGainPercent: number;
  meanConfidenceScore: number;
  estimatedPopulationCovered: number;
  allocatedStations: OptimizedStation[];
  optimizationEngine?: string;
  meanInformationGain?: number;
}

export interface TierSpecOverride {
  unitCost?: number;
  annualOm?: number;
  radiusKm?: number;
  confidence?: number;
}

export type CustomTierSpecs = Partial<Record<SensorTier, TierSpecOverride>>;

export interface BudgetPlanningPackage {
  id: string;
  title: string;
  subtitle: string;
  budget: number;
  strategy: OptimizationStrategy;
  icon: string;
  badge: string;
  color: string;
  rationale: string;
  targetFocus: string;
  recommendedTiers: {
    reference: number;
    micro: number;
    iot: number;
  };
  customSpecs?: CustomTierSpecs;
}

export const PLANNING_PACKAGES: BudgetPlanningPackage[] = [
  {
    id: "vulnerable_zones",
    title: "School & Health Clinic Protection Shield",
    subtitle: "Focus on sensitive pediatric and healthcare receptors",
    budget: 45000,
    strategy: "balanced",
    icon: "🏥",
    badge: "Vulnerable Populations",
    color: "#0f766e",
    rationale:
      "Deploys mid-tier micro sentinels equipped with acoustic & optical sensors near schools, supplemented by dense IoT nodes across residential parks.",
    targetFocus: "Schools, kindergartens, clinics, and residential courtyards",
    recommendedTiers: { reference: 0, micro: 3, iot: 12 },
  },
  {
    id: "industrial_sentinel",
    title: "Southern Industrial & Battery Megafactory Perimeter",
    subtitle: "Regulatory baseline & heavy emissions compliance",
    budget: 85000,
    strategy: "precision",
    icon: "🏭",
    badge: "Industrial Baseline",
    color: "#b45309",
    rationale:
      "Anchor regulatory EN reference stations for statutory legal compliance and dispute defense, surrounded by micro sentinels along freight corridors.",
    targetFocus: "Debrecen Southern Economic Zone, freight bypass, industrial boundary",
    recommendedTiers: { reference: 2, micro: 3, iot: 8 },
  },
  {
    id: "transit_grid",
    title: "DKV Transit & Commuter Thoroughfare Grid",
    subtitle: "Public transport stops & passenger exposure tracking",
    budget: 60000,
    strategy: "traffic",
    icon: "🚌",
    badge: "Transit Network",
    color: "#6b21a8",
    rationale:
      "Target high-passenger-frequency DKV tram/bus junctions with acoustic & NO2 micro-stations and transit corridor IoT buffers.",
    targetFocus: "Nagyállomás main hub, tram corridors, commuter radial avenues",
    recommendedTiers: { reference: 1, micro: 4, iot: 15 },
  },
  {
    id: "citywide_mesh",
    title: "Debrecen Hyper-Local Mesh Expansion",
    subtitle: "Complete municipal blind-spot elimination",
    budget: 120000,
    strategy: "coverage",
    icon: "🌐",
    badge: "Citywide Reach",
    color: "#0284c7",
    rationale:
      "Gold standard co-location: 1 reference anchor calibrating 6 micro-stations and 35 low-cost mesh nodes across suburban rings.",
    targetFocus: "Suburban districts, peri-urban residential belts, parks, outer ring",
    recommendedTiers: { reference: 1, micro: 6, iot: 35 },
  },
  {
    id: "rapid_pilot",
    title: "Fast-Track Starter Pilot",
    subtitle: "Low CapEx starter network for proof of concept",
    budget: 25000,
    strategy: "balanced",
    icon: "🚀",
    badge: "Starter Pilot",
    color: "#16a34a",
    rationale:
      "Cost-effective initial municipal rollout: 1 central micro-station and 12 IoT nodes providing fast initial coverage.",
    targetFocus: "Inner-city ring and surrounding university campuses",
    recommendedTiers: { reference: 0, micro: 1, iot: 12 },
  },
];

export interface OptimizationConstraints {
  minReference?: number;
  minMicro?: number;
  maxAnnualOm?: number | null;
  includeFiveYearTco?: boolean;
  customTierSpecs?: CustomTierSpecs;
}

export interface BudgetOptimizationResult {
  name?: string;
  badge?: string;
  description?: string;
  strategy: OptimizationStrategy;
  totalBudget: number;
  allocatedSpend: number;
  remainingBudget: number;
  budgetUtilizationPercent: number;
  totalStations: number;
  tierCounts: {
    reference: number;
    micro: number;
    iot: number;
  };
  estimatedAnnualOm: number;
  fiveYearTco: number;
  costPerResident: number;
  costPerKm2: number;
  regulatoryComplianceScore: number;
  calibrationRatio: string;
  estimatedCoverageGainPercent: number;
  meanConfidenceScore: number;
  estimatedPopulationCovered: number;
  allocatedStations: OptimizedStation[];
  optimizationEngine?: string;
  meanInformationGain?: number;
  appliedTierSpecs?: Record<
    SensorTier,
    { unitCost: number; annualOm: number; radiusKm: number; confidence: number }
  >;
  comparisons?: {
    referenceOnly: PortfolioTradeoffComparison;
    iotOnly: PortfolioTradeoffComparison;
    currentHybrid: PortfolioTradeoffComparison;
  };
}
