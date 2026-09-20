import {
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import type { Station } from "../../types/station";

interface StationTableProps {
  stations: Station[];
}

function cleanStationName(name: string): string {
  return name.replace(/\s*\([\d.,\s-]+\)$/, "").trim() || name;
}

function getPm25Chip(pm25?: number | null) {
  if (pm25 == null || !Number.isFinite(pm25)) {
    return <Chip size="small" label="No data" sx={{ fontSize: "0.72rem" }} />;
  }
  const val = Number(pm25).toFixed(1);
  if (pm25 <= 10) {
    return (
      <Chip
        size="small"
        label={`${val} µg/m³ · Good`}
        sx={{
          fontWeight: 700,
          fontSize: "0.72rem",
          backgroundColor: "#f0fdf4",
          color: "#15803d",
          border: "1px solid #bbf7d0",
        }}
      />
    );
  }
  if (pm25 <= 20) {
    return (
      <Chip
        size="small"
        label={`${val} µg/m³ · Mod`}
        sx={{
          fontWeight: 700,
          fontSize: "0.72rem",
          backgroundColor: "#fffbeb",
          color: "#b45309",
          border: "1px solid #fde68a",
        }}
      />
    );
  }
  return (
    <Chip
      size="small"
      label={`${val} µg/m³ · Alert`}
      sx={{
        fontWeight: 700,
        fontSize: "0.72rem",
        backgroundColor: "#fef2f2",
        color: "#b91c1c",
        border: "1px solid #fecaca",
      }}
    />
  );
}

export default function StationTable({ stations }: StationTableProps) {
  return (
    <TableContainer component={Paper} elevation={1} sx={{ mt: 3, borderRadius: 2 }}>
      <Typography variant="h6" sx={{ p: 2, fontWeight: 800, color: "#0f172a" }}>
        Official Debrecen Monitoring Stations
      </Typography>

      <Table size="small">
        <TableHead sx={{ backgroundColor: "#f8fafc" }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Station</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>PM2.5</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Wind Speed</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Coordinates</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {stations.map((station) => (
            <TableRow key={station.id} hover>
              <TableCell sx={{ fontWeight: 600, color: "#1e293b" }}>
                {cleanStationName(station.name)}
                {station.stationCode && (
                  <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                    #{station.stationCode}
                  </Typography>
                )}
              </TableCell>

              <TableCell>
                <Chip
                  size="small"
                  label={
                    station.station_type === 1
                      ? "💧 Surface water"
                      : "🍃 Air quality"
                  }
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    backgroundColor: station.station_type === 1 ? "#eff6ff" : "#ecfdf5",
                    color: station.station_type === 1 ? "#1d4ed8" : "#047857",
                    border: station.station_type === 1 ? "1px solid #bfdbfe" : "1px solid #a7f3d0",
                  }}
                />
              </TableCell>

              <TableCell align="right">
                {station.station_type === 1
                  ? <Typography variant="caption" color="text.secondary">Hydrological</Typography>
                  : getPm25Chip(station.pm25)}
              </TableCell>

              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {station.windSpeed != null
                  ? `${Number(station.windSpeed).toFixed(1)} km/h`
                  : "—"}
              </TableCell>

              <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#64748b" }}>
                {Number(station.lat || 0).toFixed(4)}, {Number(station.lng || 0).toFixed(4)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}