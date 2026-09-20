import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import { Box, Chip, Typography } from "@mui/material";

import CityMap from "../../components/map/CityMap";
import BudgetOptimizer from "../../components/recommendations/BudgetOptimizer";
import SimulationImpact from "../../components/recommendations/SimulationImpact";
import SimulationStatus from "../../components/recommendations/SimulationStatus";

export default function BudgetPlanning() {
  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: {
            xs: "flex-start",
            sm: "center",
          },
          justifyContent: "space-between",
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ecfdf5",
                color: "#0f766e",
                border: "1px solid #a7f3d0",
              }}
            >
              <AccountBalanceWalletOutlinedIcon fontSize="medium" />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: "#173c35",
                letterSpacing: "-0.03em",
              }}
            >
              Municipal Budget Planning
            </Typography>
          </Box>

          <Typography
            color="text.secondary"
            sx={{
              mt: 1,
              maxWidth: 960,
              lineHeight: 1.6,
            }}
          >
            GreenMind AI’s multi-tier allocation engine optimizes municipal capital expenditure (CapEx)
            and 5-year operating lifecycle costs (TCO) across certified EN Reference Stations (€28k),
            Mid-Tier Micro-Stations (€6.5k), and Low-Cost IoT Mesh Nodes (€1.2k) for the city of Debrecen.
          </Typography>
        </Box>

        <Chip
          icon={<PolicyOutlinedIcon sx={{ color: "#0f766e !important" }} />}
          label="EU Clean Air Directive Aligned"
          size="small"
          sx={{
            color: "#0f766e",
            backgroundColor: "#ecfdf5",
            border: "1px solid #a7f3d0",
            fontWeight: 700,
            py: 2,
            px: 0.5,
          }}
        />
      </Box>

      {/* Simulation Live Status & Coverage Impact */}
      <SimulationStatus />
      <SimulationImpact />

      {/* Main Budget Optimizer (Tabs: Portfolio Optimizer, Trade-off Matrix, RFP Export) */}
      <BudgetOptimizer />

      {/* Synchronized City Map for Real-Time Sensor Inspection */}
      <Box sx={{ mt: 4, mb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
            <Typography
              variant="h5"
              sx={{ fontWeight: 800, color: "#1e293b" }}
            >
              Live Municipal Deployment Simulation Map
            </Typography>

            <Chip
              size="small"
              label="Interactive: Drag Any Marker to Reposition"
              sx={{
                fontWeight: 700,
                fontSize: "0.75rem",
                backgroundColor: "#ecfdf5",
                color: "#0f766e",
                border: "1px solid #a7f3d0",
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Visualize deployed multi-tier sensor coverage halos (Tier 1: 3.5 km gold, Tier 2: 1.8 km purple, Tier 3: 0.8 km teal).
            <strong> You can drag any marker across the city to test new locations</strong>, and click any marker to convert its tier on the fly!
          </Typography>
        </Box>
        <CityMap />
      </Box>
    </Box>
  );
}
