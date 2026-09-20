import type { ReactNode } from "react";
import {
  Box,
  Paper,
  Typography,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import { InfoOutlined as InfoIcon } from "@mui/icons-material";
import { useAppTheme } from "../../context/ThemeContext";

export interface VitalSignCardProps {
  title: string;
  category: string;
  icon: ReactNode;
  statusBadge: {
    label: string;
    color: string;
    bg: string;
  };
  humanValue: string;
  technicalValue: string;
  viewMode: "citizen" | "analyst";
  humanAnalogy: string;
  technicalDetails: string;
  progressPercent: number;
  progressColor: string;
  scaleLabels: [string, string, string];
  onInfoClick?: () => void;
}

export default function VitalSignCard({
  title,
  category,
  icon,
  statusBadge,
  humanValue,
  technicalValue,
  viewMode,
  humanAnalogy,
  technicalDetails,
  progressPercent,
  progressColor,
  scaleLabels,
  onInfoClick,
}: VitalSignCardProps) {
  const { tokens } = useAppTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.75,
        borderRadius: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: tokens.cardBg,
        border: `1px solid ${tokens.cardBorder}`,
        boxShadow: tokens.cardShadow,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
        },
      }}
    >
      <Box>
        {/* Header: Icon, Category & Info Button */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: statusBadge.bg,
                color: statusBadge.color,
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.06em" }}>
                {category.toUpperCase()}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.textPrimary, lineHeight: 1.2 }}>
                {title}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Chip
              label={statusBadge.label}
              size="small"
              sx={{
                fontWeight: 800,
                fontSize: "0.75rem",
                backgroundColor: statusBadge.bg,
                color: statusBadge.color,
                border: `1px solid ${statusBadge.color}33`,
              }}
            />
            {onInfoClick && (
              <Tooltip title="What does this mean? Click for details">
                <IconButton size="small" onClick={onInfoClick} sx={{ color: "text.secondary" }}>
                  <InfoIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Primary Indicator: Large number or Human condition */}
        <Box sx={{ my: 1.75 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: tokens.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            {viewMode === "citizen" ? humanValue : technicalValue}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.textSecondary, mt: 0.5, lineHeight: 1.5, minHeight: 44 }}>
            {viewMode === "citizen" ? humanAnalogy : technicalDetails}
          </Typography>
        </Box>

        {/* Visual Progress Bar / Scale */}
        <Box sx={{ mt: 2, mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: tokens.sidebarHoverBg,
              "& .MuiLinearProgress-bar": {
                backgroundColor: progressColor,
                borderRadius: 4,
              },
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
            <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "text.secondary", fontWeight: 600 }}>
              {scaleLabels[0]}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "text.secondary", fontWeight: 600 }}>
              {scaleLabels[1]}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "text.secondary", fontWeight: 600 }}>
              {scaleLabels[2]}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Sub-label for Citizen vs Analyst */}
      <Box
        sx={{
          mt: 2,
          pt: 1.5,
          borderTop: `1px solid ${tokens.cardBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
          {viewMode === "citizen" ? "WHO Safe Guideline Aligned" : "Calibrated Sentinel Sensor Feeds"}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: statusBadge.color,
          }}
        >
          ● Active Monitoring
        </Typography>
      </Box>
    </Paper>
  );
}
