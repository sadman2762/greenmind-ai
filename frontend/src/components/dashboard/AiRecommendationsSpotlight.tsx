import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Chip,
  Skeleton,
} from "@mui/material";
import {
  AutoAwesome as AiIcon,
  ArrowForward as ArrowIcon,
  Place as PlaceIcon,
  Sensors as SensorIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { getRecommendations } from "../../services/recommendationService";
import type { SensorRecommendation } from "../../types/recommendation";
import { useAppTheme } from "../../context/ThemeContext";

export default function AiRecommendationsSpotlight() {
  const { tokens } = useAppTheme();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<SensorRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecs() {
      try {
        const data = await getRecommendations();
        setRecommendations(data.slice(0, 3));
      } catch {
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    }
    loadRecs();
  }, []);

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
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <AiIcon sx={{ color: "#00dc82" }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.textPrimary }}>
              Where Debrecen Needs New Sensors
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            AI-recommended locations to close monitoring blind spots and protect public health.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          endIcon={<ArrowIcon />}
          onClick={() => navigate("/recommendations")}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            textTransform: "none",
            borderColor: tokens.cardBorder,
            color: tokens.textPrimary,
            "&:hover": {
              borderColor: tokens.accent,
              backgroundColor: tokens.sidebarHoverBg,
            },
          }}
        >
          View Full Interactive Map
        </Button>
      </Box>

      {loading ? (
        <Grid container spacing={2.5}>
          {[1, 2, 3].map((n) => (
            <Grid key={n} size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={180} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={2.5}>
          {recommendations.map((rec, index) => {
            const priorityPercent = Math.round(
              rec.priorityScore <= 1 ? rec.priorityScore * 100 : rec.priorityScore
            );
            const confidencePercent = Math.round(
              rec.overallConfidence <= 1 ? rec.overallConfidence * 100 : rec.overallConfidence
            );
            const sensorLabel =
              rec.recommendationType === "air_sensor"
                ? "Air Quality Sensor"
                : rec.recommendationType === "noise_sensor"
                ? "Acoustic Noise Sensor"
                : "Multi-Domain Station";

            return (
              <Grid key={rec.id || index} size={{ xs: 12, md: 4 }}>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: tokens.sidebarHoverBg,
                    border: `1px solid ${tokens.cardBorder}`,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
                    },
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                      <Chip
                        label={`#${index + 1} AI Priority`}
                        size="small"
                        sx={{
                          fontWeight: 800,
                          bgcolor: index === 0 ? "#00dc82" : "#0f766e",
                          color: "#ffffff",
                          fontSize: "0.75rem",
                        }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#059669" }}>
                        {priorityPercent}% Priority Score
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
                      <PlaceIcon sx={{ color: "#ef4444", fontSize: 20, mt: 0.3 }} />
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.3 }}>
                          Near {rec.nearestStation}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Blind spot {rec.distanceKm.toFixed(1)} km from current station
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 1.25 }}>
                      <SensorIcon sx={{ color: "#3b82f6", fontSize: 18 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.textPrimary }}>
                        {sensorLabel}
                      </Typography>
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5 }}>
                      {rec.primaryMonitoringNeed === "air"
                        ? "Helps detect vehicle particulate build-up and industrial drift."
                        : rec.primaryMonitoringNeed === "noise"
                        ? "Monitors sound emissions along busy transit corridors to safeguard sleep."
                        : "Comprehensive monitoring for suburban residential expansion."}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${tokens.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Confidence: {confidencePercent}%
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => navigate("/recommendations")}
                      sx={{
                        p: 0,
                        minWidth: "auto",
                        textTransform: "none",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: tokens.accentHover,
                      }}
                    >
                      Locate on Map ➔
                    </Button>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Paper>
  );
}
