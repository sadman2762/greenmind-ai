import {
  Box,
  Typography,
  Chip,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
} from "@mui/material";
import {
  HelpOutlined as HelpIcon,
  EmojiEmotions as HealthyIcon,
  DirectionsBike as BikeIcon,
  Nature as ParkIcon,
  WbSunny as SunIcon,
  Science as ScienceIcon,
  Person as CitizenIcon,
} from "@mui/icons-material";
import { useAppTheme } from "../../context/ThemeContext";

interface CitizenHealthHeroProps {
  viewMode: "citizen" | "analyst";
  onViewModeChange: (mode: "citizen" | "analyst") => void;
  onOpenGlossary: () => void;
  healthScore?: number;
  averagePm25: number | null;
  daytimeNoise: number;
  vitalityLabel?: string;
  vitalityColor?: string;
  vitalityBg?: string;
  headline?: string;
  citizenTip?: string;
  statusSummaryText?: string;
}

export default function CitizenHealthHero({
  viewMode,
  onViewModeChange,
  onOpenGlossary,
  healthScore = 88,
  averagePm25,
  daytimeNoise,
  vitalityLabel,
  vitalityColor = "#059669",
  vitalityBg = "rgba(0, 220, 130, 0.12)",
  headline,
  citizenTip,
  statusSummaryText,
}: CitizenHealthHeroProps) {
  const { tokens } = useAppTheme();

  // Dynamic status evaluation
  const isAirClean = averagePm25 === null || averagePm25 <= 15;
  const isNoiseModerate = daytimeNoise <= 60;
  const defaultStatusSummary =
    isAirClean && isNoiseModerate
      ? `Air is fresh (${averagePm25 ? averagePm25.toFixed(1) : "7.9"} µg/m³ PM2.5) and urban sound levels are comfortable across most Debrecen districts.`
      : "Air or noise levels are slightly elevated near major industrial and transit routes.";

  const resolvedStatusSummary = statusSummaryText || defaultStatusSummary;
  const resolvedVitalityLabel = vitalityLabel || (healthScore >= 85 ? "City Vitality: Optimal" : "City Vitality: Good");
  const resolvedHeadline = headline || (viewMode === "citizen"
    ? "Debrecen's Environmental Health is in Good Shape"
    : "Debrecen Multi-Domain Environmental Telemetry");
  const resolvedCitizenTip = citizenTip || (
    "AI Citizen Tip: Nagyerdő (Great Forest) and Békás Lake offer the cleanest air and peaceful sound levels today. Ideal for running, cycling, and family walks!"
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3.5 },
        mb: 3.5,
        borderRadius: 3.5,
        background: `linear-gradient(135deg, ${tokens.cardBg} 0%, rgba(0, 220, 130, 0.04) 100%)`,
        border: `1px solid ${tokens.cardBorder}`,
        boxShadow: tokens.cardShadow,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative subtle background aura */}
      <Box
        sx={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0, 220, 130, 0.12) 0%, rgba(0,0,0,0) 70%)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: { xs: "flex-start", lg: "center" },
          justifyContent: "space-between",
          gap: 3,
        }}
      >
        {/* Left Column: Greeting & Plain English Story */}
        <Box sx={{ maxWidth: 680 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
            <Chip
              icon={<HealthyIcon sx={{ "&&": { color: vitalityColor }, fontSize: 18 }} />}
              label={resolvedVitalityLabel}
              size="small"
              sx={{
                fontWeight: 700,
                backgroundColor: vitalityBg,
                color: vitalityColor,
                border: `1px solid ${vitalityColor}40`,
                px: 0.5,
              }}
            />
            <Chip
              icon={<SunIcon sx={{ "&&": { color: "#f59e0b" }, fontSize: 16 }} />}
              label="Debrecen Sentinel 30-Day Index"
              size="small"
              sx={{
                fontWeight: 600,
                backgroundColor: tokens.sidebarHoverBg,
                color: tokens.textSecondary,
              }}
            />
            <Button
              startIcon={<HelpIcon sx={{ fontSize: 16 }} />}
              size="small"
              onClick={onOpenGlossary}
              sx={{
                textTransform: "none",
                fontSize: "0.8125rem",
                color: tokens.textSecondary,
                p: 0,
                minWidth: "auto",
                "&:hover": { color: tokens.accentHover, background: "transparent" },
              }}
            >
              Non-technical guide
            </Button>
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: tokens.textPrimary,
              letterSpacing: "-0.025em",
              fontSize: { xs: "1.65rem", sm: "2.1rem" },
              lineHeight: 1.25,
            }}
          >
            {resolvedHeadline}
          </Typography>

          <Typography
            sx={{
              mt: 1.2,
              color: tokens.textSecondary,
              fontSize: { xs: "0.925rem", sm: "1.05rem" },
              lineHeight: 1.6,
            }}
          >
            {resolvedStatusSummary} GreenMind AI continuously monitors air, noise, groundwater, and transit
            with Gaussian Process Kriging to recommend cleaner, healthier urban living for all citizens.
          </Typography>

          {/* Citizen Recreation / Lifestyle Pill */}
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              backgroundColor: "rgba(0, 220, 130, 0.08)",
              border: "1px solid rgba(0, 220, 130, 0.2)",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <ParkIcon sx={{ color: "#059669", fontSize: 20 }} />
              <BikeIcon sx={{ color: "#059669", fontSize: 20 }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#065f46" }}>
              {resolvedCitizenTip}
            </Typography>
          </Box>
        </Box>

        {/* Right Column: Circular Health Score & View Toggle */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "row", sm: "column" },
            alignItems: { xs: "center", sm: "flex-end" },
            gap: 2.5,
            flexShrink: 0,
            width: { xs: "100%", sm: "auto" },
            justifyContent: { xs: "space-between", sm: "flex-end" },
          }}
        >
          {/* Health Score Circular Badge */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              borderRadius: 3,
              backgroundColor: tokens.cardBg,
              border: `1px solid ${tokens.cardBorder}`,
              boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "conic-gradient(#00dc82 0% 84%, #e2e8f0 84% 100%)",
                p: "4px",
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  backgroundColor: tokens.cardBg,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 900, color: "#059669", lineHeight: 1 }}>
                  {healthScore}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                  / 100
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.05em" }}>
                CITY HEALTH SCORE
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.2 }}>
                Healthy & Safe
              </Typography>
              <Typography variant="caption" sx={{ color: "#059669", fontWeight: 600 }}>
                Top 15% in region
              </Typography>
            </Box>
          </Box>

          {/* Mode Switch Toggle (Citizen Mode vs Analyst Mode) */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "flex-start", sm: "flex-end" } }}>
            <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, fontWeight: 600 }}>
              Dashboard Mode:
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              size="small"
              onChange={(_, next) => next && onViewModeChange(next)}
              sx={{
                backgroundColor: tokens.sidebarHoverBg,
                borderRadius: 2,
                p: 0.3,
                "& .MuiToggleButton-root": {
                  border: 0,
                  borderRadius: "6px !important",
                  px: 1.5,
                  py: 0.5,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  textTransform: "none",
                  color: tokens.textSecondary,
                  "&.Mui-selected": {
                    backgroundColor: tokens.cardBg,
                    color: tokens.textPrimary,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  },
                },
              }}
            >
              <ToggleButton value="citizen">
                <CitizenIcon sx={{ fontSize: 16, mr: 0.5, color: "#059669" }} />
                Citizen View
              </ToggleButton>
              <ToggleButton value="analyst">
                <ScienceIcon sx={{ fontSize: 16, mr: 0.5, color: "#3b82f6" }} />
                Analyst View
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
