export const campusReference = {
  name: "University of Debrecen, Faculty of Informatics",
  address: "Kassai út 26, Debrecen",
  entrance: { lat: 47 + 32.543 / 60, lng: 21 + 38.385 / 60 },
  addressSource: "https://inf.unideb.hu/en/address",
  campusSource: "https://inf.unideb.hu/sites/default/files/kassai_uti_campus.webp",
  architectureSource: "https://architecturehungary.hu/collection/university-of-debrecen-it-faculty/",
  visualReference: "User-supplied Screenshot 2026-09-21 at 2.19.37.png; Kassai campus AnyMap view",
  fidelity: "Published entrance coordinates; visible campus forms and relative placement reconstructed from the user's oblique screenshot, with estimated dimensions and hidden elevations. The blind spot and deployment are fictional.",
} as const;

export function geoToScene(lat: number, lng: number): [number, number, number] {
  const longitudeScale = 111320 * Math.cos(campusReference.entrance.lat * Math.PI / 180);
  return [(lng - campusReference.entrance.lng) * longitudeScale, 0, -(lat - campusReference.entrance.lat) * 111320];
}

export const existingSensors = [
  { id: 1, lat: 47.54820104, lng: 21.66937425 },
  { id: 2, lat: 47.53312747, lng: 21.64505351 },
  { id: 3, lat: 47.50509508, lng: 21.63577625 },
  { id: 4, lat: 47.56103507, lng: 21.63423132 },
  { id: 5, lat: 47.54547049, lng: 21.61669657 },
  { id: 6, lat: 47.52506265, lng: 21.60358902 },
  { id: 7, lat: 47.52324542, lng: 21.6337404 },
  { id: 8, lat: 47.55811817, lng: 21.83798877 },
  { id: 9, lat: 47.55757175, lng: 21.59611899 },
  { id: 10, lat: 47.44742297, lng: 21.63063962 },
  { id: 11, lat: 47.54361985, lng: 21.62301311 },
  { id: 12, lat: 47.59773497, lng: 21.58018664 },
  { id: 13, lat: 47.592025, lng: 21.585885 },
  { id: 14, lat: 47.45773804, lng: 21.59987887 },
  { id: 15, lat: 47.577175, lng: 21.502204 },
  { id: 18, lat: 47.46163523, lng: 21.63297768 },
] as const;

export const stationReference = "Snapshot of /api/official-stations/ backed by backend/data/green-sentinel-points.json; 16 stations, 2026-09-21. Not a live status feed.";

export const greatChurch = { lat: 47.53194, lng: 21.62389 } as const;
