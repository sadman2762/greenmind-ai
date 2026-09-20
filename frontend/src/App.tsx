import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { SimulationProvider } from "./context/SimulationContext";
import { ThemeCustomProvider } from "./context/ThemeContext";
import { MaintenanceProvider } from "./context/MaintenanceContext";

import MainLayout from "./layouts/MainLayout";

import Dashboard from "./pages/Dashboard";
import Recommendations from "./pages/Recommendations";
import BudgetPlanning from "./pages/BudgetPlanning";
import SensorHealth from "./pages/SensorHealth";
import MaintenanceSchedule from "./pages/MaintenanceSchedule";

function App() {
  return (
    <ThemeCustomProvider>
      <SimulationProvider>
        <MaintenanceProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route
                  path="/recommendations"
                  element={<Recommendations />}
                />
                <Route
                  path="/budget-planning"
                  element={<BudgetPlanning />}
                />
                <Route
                  path="/sensor-health"
                  element={<SensorHealth />}
                />
                <Route
                  path="/maintenance-schedule"
                  element={<MaintenanceSchedule />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </MaintenanceProvider>
      </SimulationProvider>
    </ThemeCustomProvider>
  );
}

export default App;
