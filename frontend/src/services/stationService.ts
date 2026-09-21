import type { Station } from "../types/station";
import { API_BASE_URL as API_ORIGIN } from "./api";

interface OfficialStationApiResponse {
  count: number;
  source: string;
  stations: Station[];
}

const API_URL = `${API_ORIGIN}/api/official-stations/`;

export async function getStations(): Promise<Station[]> {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to load official stations: ${response.status} ${response.statusText}`,
    );
  }

  const data: OfficialStationApiResponse = await response.json();

  return data.stations;
}