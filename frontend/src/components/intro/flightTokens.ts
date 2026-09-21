export const FLIGHT_DURATION = 11.5;
export const LOGO_REVEAL_TIME = 10.8;

export const flightColors = {
  sky: "#b6cfdf",
  cloud: "#f7f8fa",
  cloudShadow: "#8b9dab",
  cloudWarm: "#fff4e3",
  grass: "#82976a",
  lawn: "#8da36c",
  forest: "#447753",
  leaf: "#5b915c",
  leafLight: "#80a86a",
  trunk: "#796f55",
  cream: "#f1ece0",
  white: "#faf8ee",
  concrete: "#d3d6cc",
  road: "#777b76",
  path: "#d0c9b8",
  roof: "#bd795d",
  roofLight: "#d09572",
  glass: "#a7bdc9",
  glassDark: "#506675",
  metal: "#70857b",
  green: "#35d991",
  deepGreen: "#164d39",
  network: "#14875a",
  field: "#b9c18b",
  fieldDark: "#88a972",
  fieldGold: "#c3bc89",
  amber: "#efad47",
  water: "#83b9af",
  heritage: "#e8d8ad",
  terracotta: "#c87b4c",
  slate: "#777c82",
  brick: "#ad6f53",
  court: "#737686",
} as const;

export const flightChapters = [
  { id: "sky", start: 0, detail: "Clouds part above a green, stylized Debrecen." },
  { id: "city", start: 1.6, detail: "An eagle-eye view passes Debrecen's rooftops and Great Forest." },
  { id: "campus", start: 3.3, detail: "The camera descends toward the Faculty of Informatics on Kassai campus." },
  { id: "blindspot", start: 5.2, detail: "An illustrative blind spot is highlighted at the published DEIK entrance coordinates." },
  { id: "sensor", start: 6.3, detail: "A simulated environmental sensor is placed at the entrance." },
  { id: "network", start: 7.5, detail: "The camera rises as the new sensor connects to sixteen existing project stations." },
  { id: "clouds", start: 9.6, detail: "Clouds gather over the connected city." },
  { id: "logo", start: LOGO_REVEAL_TIME, detail: "GreenMind AI. The workspace is ready." },
] as const;

export type FlightPhase = typeof flightChapters[number]["id"];

export function flightPhase(time: number): FlightPhase {
  return [...flightChapters].reverse().find((chapter) => time >= chapter.start)?.id ?? "sky";
}

export function connectionProgress(time: number, index: number) {
  return Math.max(0, Math.min(1, (time - 7.5 - index * 0.035) / 1.15));
}
