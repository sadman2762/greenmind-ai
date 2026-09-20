import { Box, Typography } from "@mui/material";
import { useAppTheme } from "../../context/ThemeContext";

interface BrandLogoProps {
  variant?: "header" | "footer" | "hero";
  showTagline?: boolean;
  compact?: boolean;
}

export default function BrandLogo({
  variant = "header",
  showTagline = true,
  compact = false,
}: BrandLogoProps) {
  const { tokens, isMidnight } = useAppTheme();

  const isDarkSurface = variant === "hero" || (isMidnight && variant === "header") || variant === "footer";

  const word1Color = isDarkSurface ? tokens.brandNameWord1 : (isMidnight ? "#0b1329" : tokens.brandNameWord1);
  const word2Color = tokens.brandNameWord2;
  const taglineColor = isDarkSurface ? tokens.brandTaglineColor : tokens.textSecondary;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", userSelect: "none" }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
        <Typography
          component="span"
          sx={{
            fontWeight: 900,
            fontSize: compact ? "1.25rem" : "1.45rem",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: word1Color,
            fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
          }}
        >
          GreenMind
        </Typography>

        <Typography
          component="span"
          sx={{
            fontWeight: 900,
            fontSize: compact ? "1.25rem" : "1.45rem",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: word2Color,
            fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
            textShadow: isMidnight ? "0 0 16px rgba(0, 220, 130, 0.4)" : "none",
          }}
        >
          AI
        </Typography>
      </Box>

      {showTagline && (
        <Typography
          variant="caption"
          sx={{
            mt: 0.35,
            fontSize: compact ? "0.68rem" : "0.74rem",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: taglineColor,
            lineHeight: 1.2,
            display: {
              xs: "none",
              sm: "block",
            },
          }}
        >
          {tokens.brandTagline}
        </Typography>
      )}
    </Box>
  );
}
