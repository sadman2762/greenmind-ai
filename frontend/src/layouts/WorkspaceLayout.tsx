import { SimulationProvider } from "../context/SimulationContext";
import { MaintenanceProvider } from "../context/MaintenanceContext";
import MainLayout from "./MainLayout";

export default function WorkspaceLayout() {
  return (
    <SimulationProvider>
      <MaintenanceProvider>
        <MainLayout />
      </MaintenanceProvider>
    </SimulationProvider>
  );
}
