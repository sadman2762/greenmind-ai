import { lazy, Suspense } from "react";
import { Box, Skeleton, Stack, Typography } from "@mui/material";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeCustomProvider, useAppTheme } from "./context/ThemeContext";
import Intro from "./pages/Intro";

const WorkspaceLayout = lazy(() => import("./layouts/WorkspaceLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const BudgetPlanning = lazy(() => import("./pages/BudgetPlanning"));
const SensorHealth = lazy(() => import("./pages/SensorHealth"));
const MaintenanceSchedule = lazy(() => import("./pages/MaintenanceSchedule"));

function WorkspaceLoading() {
  const { tokens } = useAppTheme();
  return (
    <Stack component="main" spacing={3} sx={{ minHeight: "100svh", p: 4, background: tokens.appBg, color: tokens.textPrimary }} role="status" aria-label="Opening GreenMind workspace">
      <Typography variant="h6">Opening GreenMind workspace</Typography>
      <Box sx={{ maxWidth: 640 }}><Skeleton height={80} /><Skeleton height={240} /></Box>
    </Stack>
  );
}

function App() {
  return (
    <ThemeCustomProvider>
      <BrowserRouter>
        <Suspense fallback={<WorkspaceLoading />}>
          <Routes>
            <Route path="/" element={<Intro />} />
            <Route element={<WorkspaceLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/budget-planning" element={<BudgetPlanning />} />
              <Route path="/sensor-health" element={<SensorHealth />} />
              <Route path="/maintenance-schedule" element={<MaintenanceSchedule />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeCustomProvider>
  );
}

export default App;
