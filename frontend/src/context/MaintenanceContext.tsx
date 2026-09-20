import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  cancelWorkOrderApi,
  createWorkOrderApi,
  fetchAllWorkOrders,
  updateWorkOrderApi,
  type CreateWorkOrderInput,
  type PriorityLevel,
  type WorkOrder,
} from "../services/maintenanceService";

interface MaintenanceContextType {
  orders: WorkOrder[];
  loading: boolean;
  error: string | null;
  refreshOrders: () => Promise<void>;
  dispatchOrder: (input: CreateWorkOrderInput) => Promise<WorkOrder>;
  rescheduleOrder: (
    orderId: string,
    newDate: string,
    newTime: string,
    technician?: string,
    notes?: string
  ) => Promise<void>;
  updatePriority: (orderId: string, priority: PriorityLevel) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  isStationScheduled: (stationCode: string) => boolean;
  getStationOrder: (stationCode: string) => WorkOrder | undefined;
}

const MaintenanceContext = createContext<MaintenanceContextType>({
  orders: [],
  loading: false,
  error: null,
  refreshOrders: async () => {},
  dispatchOrder: async () => ({} as WorkOrder),
  rescheduleOrder: async () => {},
  updatePriority: async () => {},
  cancelOrder: async () => {},
  isStationScheduled: () => false,
  getStationOrder: () => undefined,
});

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAllWorkOrders();
      setOrders(res.orders);
    } catch (err: any) {
      console.error("Failed to load maintenance orders:", err);
      setError(err?.message || "Failed to load maintenance orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  const dispatchOrder = async (input: CreateWorkOrderInput): Promise<WorkOrder> => {
    const newOrder = await createWorkOrderApi(input);
    setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
    return newOrder;
  };

  const rescheduleOrder = async (
    orderId: string,
    newDate: string,
    newTime: string,
    technician?: string,
    notes?: string
  ) => {
    const updated = await updateWorkOrderApi(orderId, {
      scheduledDate: newDate,
      scheduledTime: newTime,
      assignedTechnician: technician,
      notes,
    });
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  const updatePriority = async (orderId: string, priority: PriorityLevel) => {
    const updated = await updateWorkOrderApi(orderId, { priority });
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
  };

  const cancelOrder = async (orderId: string) => {
    await cancelWorkOrderApi(orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const isStationScheduled = (stationCode: string): boolean => {
    return orders.some(
      (o) =>
        o.stationCode === stationCode &&
        (o.status === "SCHEDULED" || o.status === "IN_PROGRESS")
    );
  };

  const getStationOrder = (stationCode: string): WorkOrder | undefined => {
    return orders.find(
      (o) =>
        o.stationCode === stationCode &&
        (o.status === "SCHEDULED" || o.status === "IN_PROGRESS")
    );
  };

  return (
    <MaintenanceContext.Provider
      value={{
        orders,
        loading,
        error,
        refreshOrders,
        dispatchOrder,
        rescheduleOrder,
        updatePriority,
        cancelOrder,
        isStationScheduled,
        getStationOrder,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  return useContext(MaintenanceContext);
}
