import { API_BASE_URL as API } from "./api";

export interface TrafficLocation {
  stopName: string;
  latitude: number;
  longitude: number;
  trafficActivityScore: number;
  passengerFrequencyTotal: number;
  passengersInTotal: number;
  passengersOutTotal: number;
}

interface TrafficResponse {
  count: number;
  source: string;
  locations: TrafficLocation[];
}

export async function getTrafficLocations(): Promise<TrafficLocation[]> {
  const response = await fetch(`${API}/traffic`);

  if (!response.ok) {
    throw new Error("Failed to load DKV traffic locations.");
  }

  const data: TrafficResponse = await response.json();

  return data.locations;
}