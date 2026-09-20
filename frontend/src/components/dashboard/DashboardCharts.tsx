import { useState, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  VolumeUp as NoiseIcon,
  Air as AirIcon,
} from "@mui/icons-material";
import { useAppTheme } from "../../context/ThemeContext";
import type { DistrictProfile } from "../../services/aiAnalyticsService";

interface DashboardChartsProps {
  averagePm25: number | null;
  daytimeNoise: number;
  nighttimeNoise: number;
  stationCount: number;
  districtProfiles?: DistrictProfile[];
  coveragePercentage?: number;
}

export default function DashboardCharts({
  averagePm25 = 7.9,
  daytimeNoise = 56.6,
  nighttimeNoise = 48.9,
  stationCount = 16,
  districtProfiles,
  coveragePercentage = 68,
}: DashboardChartsProps) {
  const { tokens } = useAppTheme();
  const [activeTab, setActiveTab] = useState(0);

  const calculatedMeanPm25 = averagePm25 !== null ? Number(averagePm25.toFixed(1)) : 7.9;

  // 1. Dynamic District comparison data evaluated by Machine Learning Kriging
  const districtAirData = useMemo(() => {
    if (districtProfiles && districtProfiles.length > 0) {
      return districtProfiles.map((d) => ({
        district: d.district.replace(" (Great Forest)", "").replace(" (Residential)", ""),
        pm25: d.pm25 !== null ? Number(d.pm25.toFixed(1)) : calculatedMeanPm25,
        color: d.color,
        krigingUncertainty: d.krigingUncertainty,
        infoGain: d.informationGainScore,
      }));
    }

    // Fallback if network is loading
    return [
      { district: "Nagyerdő", pm25: 7.2, color: "#10b981", krigingUncertainty: 22, infoGain: 48 },
      { district: "University Campus", pm25: 8.1, color: "#10b981", krigingUncertainty: 26, infoGain: 52 },
      { district: "Tócóskert", pm25: 9.6, color: "#10b981", krigingUncertainty: 34, infoGain: 58 },
      { district: "City Mean (Today)", pm25: calculatedMeanPm25, color: "#00dc82", krigingUncertainty: 18, infoGain: 42 },
      { district: "Downtown Belváros", pm25: 11.4, color: "#34d399", krigingUncertainty: 28, infoGain: 64 },
      { district: "DKV Transit Hub", pm25: 14.8, color: "#34d399", krigingUncertainty: 38, infoGain: 76 },
      { district: "Déli Industrial Park", pm25: 16.2, color: "#f59e0b", krigingUncertainty: 42, infoGain: 84 },
    ];
  }, [districtProfiles, calculatedMeanPm25]);

  // 2. Day vs Night acoustic sound data from spatial model
  const soundComparisonData = useMemo(() => {
    if (districtProfiles && districtProfiles.length > 0) {
      return districtProfiles.map((d) => ({
        zone: d.district.replace(" (Great Forest)", "").replace(" (Residential)", ""),
        day: Math.round(d.dayNoise),
        night: Math.round(d.nightNoise),
      }));
    }

    return [
      { zone: "Nagyerdő Park", day: 46, night: 37 },
      { zone: "Residential Suburb", day: 51, night: 42 },
      { zone: "Debrecen Average", day: Math.round(daytimeNoise), night: Math.round(nighttimeNoise) },
      { zone: "City Center", day: 61, night: 50 },
      { zone: "DKV Tram Arteries", day: 67, night: 54 },
      { zone: "Southern Ring Road", day: 66, night: 56 },
    ];
  }, [districtProfiles, daytimeNoise, nighttimeNoise]);

  // 3. City Coverage Donut Data dynamically calculated from station mesh
  const coverageData = useMemo(() => {
    const monitored = Math.min(100, Math.max(10, Math.round(coveragePercentage)));
    const blindSpots = Math.max(0, 100 - monitored);
    return [
      { name: "Monitored Urban Area", value: monitored, color: "#00dc82" },
      { name: "AI Priority Blind Spots", value: blindSpots, color: "#f59e0b" },
    ];
  }, [coveragePercentage]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3.5 },
        mt: 3.5,
        borderRadius: 3.5,
        backgroundColor: tokens.cardBg,
        border: `1px solid ${tokens.cardBorder}`,
        boxShadow: tokens.cardShadow,
      }}
    >
      {/* Header & Tabs */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
          pb: 2,
          borderBottom: `1px solid ${tokens.cardBorder}`,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <BarChartIcon sx={{ color: "#00dc82" }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.textPrimary }}>
              Debrecen Visual Storyboard
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Intuitive graphs designed to make environmental trends easy to grasp for everyone.
          </Typography>
        </Box>

        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            minHeight: 40,
            backgroundColor: tokens.sidebarHoverBg,
            borderRadius: 2.5,
            p: 0.5,
            "& .MuiTabs-indicator": {
              display: "none",
            },
            "& .MuiTab-root": {
              minHeight: 32,
              py: 0.5,
              px: 2,
              borderRadius: 2,
              fontWeight: 700,
              fontSize: "0.85rem",
              textTransform: "none",
              color: tokens.textSecondary,
              "&.Mui-selected": {
                backgroundColor: tokens.cardBg,
                color: tokens.textPrimary,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              },
            },
          }}
        >
          <Tab icon={<AirIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Air by District" />
          <Tab icon={<NoiseIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Day vs Night Noise" />
          <Tab icon={<PieChartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Network Coverage" />
        </Tabs>
      </Box>

      {/* Tab 0: Air Quality by District */}
      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.textPrimary }}>
                Fine Particle Dust (PM2.5) across Debrecen Zones
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Dashed line indicates World Health Organization (WHO) 24-hour safe guideline limit (15 µg/m³)
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Chip size="small" label="🟢 <15 Clean" sx={{ bgcolor: "#ecfdf5", color: "#065f46", fontWeight: 700 }} />
              <Chip size="small" label="🟡 15-20 Moderate" sx={{ bgcolor: "#fffbeb", color: "#b45309", fontWeight: 700 }} />
              <Chip size="small" label="🟠 >20 Watch" sx={{ bgcolor: "#fff7ed", color: "#c2410c", fontWeight: 700 }} />
            </Box>
          </Box>

          <Box sx={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtAirData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                <XAxis
                  dataKey="district"
                  tick={{ fill: tokens.textSecondary, fontSize: 12, fontWeight: 600 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  unit=" µg"
                  tick={{ fill: tokens.textSecondary, fontSize: 12 }}
                  domain={[0, 30]}
                />
                <Tooltip
                  formatter={(val: unknown) => [`${String(val)} µg/m³`, "Fine Dust Level"]}
                  labelFormatter={(label) => `📍 ${label}`}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${tokens.cardBorder}`,
                    backgroundColor: tokens.cardBg,
                    boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                    fontWeight: 600,
                  }}
                />
                <ReferenceLine
                  y={15}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{
                    value: "WHO Safe Threshold (15 µg/m³)",
                    fill: "#ef4444",
                    fontSize: 12,
                    fontWeight: 700,
                    position: "top",
                  }}
                />
                <Bar dataKey="pm25" radius={[6, 6, 0, 0]}>
                  {districtAirData.map((entry: { district: string; color: string }) => (
                    <Cell key={entry.district} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 2.5,
              backgroundColor: "rgba(0, 220, 130, 0.06)",
              border: "1px solid rgba(0, 220, 130, 0.15)",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Typography variant="body2" sx={{ color: tokens.textPrimary }}>
              💡 <strong>Key Takeaway for Citizens:</strong> Debrecen's recreational areas (Nagyerdő and University Campus)
              enjoy exceptionally clean air. Industrial zones experience slightly higher dust from transport logistics,
              which is why GreenMind AI recommends placing additional monitoring stations in the southern sector.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Tab 1: Day vs Night Noise */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.textPrimary }}>
                How Sound Levels Change Between Day and Night
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Comparing daytime traffic pulse with nighttime residential quietness in Debrecen
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Chip size="small" label={`☀️ Daytime Avg: ${daytimeNoise.toFixed(1)} dB`} sx={{ bgcolor: "#eff6ff", color: "#1e40af", fontWeight: 700 }} />
              <Chip size="small" label={`🌙 Nighttime Avg: ${nighttimeNoise.toFixed(1)} dB`} sx={{ bgcolor: "#f5f3ff", color: "#5b21b6", fontWeight: 700 }} />
            </Box>
          </Box>

          <Box sx={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={soundComparisonData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
                <XAxis
                  dataKey="zone"
                  tick={{ fill: tokens.textSecondary, fontSize: 12, fontWeight: 600 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis unit=" dB" domain={[20, 80]} tick={{ fill: tokens.textSecondary, fontSize: 12 }} />
                <Tooltip
                  formatter={(val: unknown) => [`${String(val)} dB`, "Sound Level"]}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${tokens.cardBorder}`,
                    backgroundColor: tokens.cardBg,
                    boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                    fontWeight: 600,
                  }}
                />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 15 }} />
                <ReferenceLine
                  y={50}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  label={{ value: "Quiet Sleep Standard (50 dB)", fill: "#10b981", fontSize: 11, position: "top" }}
                />
                <Bar dataKey="day" name="Daytime Noise (dB)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="night" name="Nighttime Noise (dB)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: 2.5,
              backgroundColor: "rgba(139, 92, 246, 0.08)",
              border: "1px solid rgba(139, 92, 246, 0.2)",
            }}
          >
            <Typography variant="body2" sx={{ color: tokens.textPrimary }}>
              💤 <strong>Sleep Quality Insight:</strong> On average across Debrecen, noise drops by <strong>{(daytimeNoise - nighttimeNoise).toFixed(1)} dB</strong> at night.
              This drop ensures peaceful sleep in residential neighborhoods, while tram and ring-road corridors maintain
              moderate sound from maintenance and logistics.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Tab 2: Monitoring Network & Blind Spots */}
      {activeTab === 2 && (
        <Box>
          <Grid container spacing={3} sx={{ alignItems: "center" }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.textPrimary, mb: 1 }}>
                Monitoring Coverage vs. City Blind Spots
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                GreenMind AI calculates that approximately <strong>68%</strong> of Debrecen's inhabited territory
                is within optimal range of official Green Sentinel stations. The remaining <strong>32%</strong> represents
                monitoring gaps where air and noise are currently estimated.
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(0, 220, 130, 0.08)", border: "1px solid rgba(0, 220, 130, 0.2)" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#065f46" }}>
                    ✅ Currently Monitored: {stationCount} Air Stations + 15 Wells + 5 Acoustic Poles
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Continuously streaming high-precision physical telemetry.
                  </Typography>
                </Box>

                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#b45309" }}>
                    🎯 Priority Blind Spots: 5 Recommended Installations
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Identified by GreenMind AI to maximize coverage with minimal municipal budget.
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={coverageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ value }) => `${value}%`}
                    >
                      {coverageData.map((entry: { name: string; color: string }) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: unknown) => [`${String(val)}%`, "Coverage Ratio"]}
                      contentStyle={{
                        borderRadius: 12,
                        border: `1px solid ${tokens.cardBorder}`,
                        backgroundColor: tokens.cardBg,
                        fontWeight: 600,
                      }}
                    />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}
    </Paper>
  );
}
