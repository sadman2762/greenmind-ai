import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import BuildCircleRoundedIcon from "@mui/icons-material/BuildCircleRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import {
  Box,
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { useAppTheme } from "../../context/ThemeContext";

const drawerWidth = 280;

const menu = [
  {
    text: "Dashboard",
    path: "/",
    icon: <DashboardRoundedIcon />,
  },
  {
    text: "Sensor Recommendations",
    path: "/recommendations",
    icon: <InsightsRoundedIcon />,
  },
  {
    text: "Budget Planning",
    path: "/budget-planning",
    icon: <AccountBalanceWalletRoundedIcon />,
  },
  {
    text: "Sensor Health",
    path: "/sensor-health",
    icon: <BuildCircleRoundedIcon />,
  },
  {
    text: "Maintenance Schedule",
    path: "/maintenance-schedule",
    icon: <CalendarMonthRoundedIcon />,
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { tokens, isMidnight } = useAppTheme();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        display: {
          xs: "none",
          md: "block",
        },
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          top: 76,
          height: "calc(100vh - 76px)",
          borderRight: `1px solid ${tokens.sidebarBorder}`,
          background: tokens.sidebarBg,
          transition: "background 0.3s ease, border-color 0.3s ease",
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          pt: 3,
          pb: 2,
        }}
      >
        <Typography
          variant="overline"
          sx={{
            color: tokens.textMuted,
            fontWeight: 800,
            letterSpacing: "0.12em",
          }}
        >
          Navigation
        </Typography>
      </Box>

      <List
        sx={{
          px: 1.5,
          py: 0,
        }}
      >
        {menu.map((item) => {
          const selected = location.pathname === item.path;

          return (
            <ListItemButton
              key={item.text}
              component={Link}
              to={item.path}
              selected={selected}
              sx={{
                position: "relative",
                minHeight: 52,
                mb: 0.75,
                px: 1.5,
                borderRadius: 2.5,
                color: selected ? tokens.sidebarActiveColor : tokens.sidebarTextColor,
                transition:
                  "background-color 160ms ease, color 160ms ease, transform 160ms ease",
                "&:hover": {
                  backgroundColor: tokens.sidebarHoverBg,
                  color: isMidnight ? "#00dc82" : tokens.primary,
                  transform: "translateX(2px)",
                },
                "&.Mui-selected": {
                  backgroundColor: tokens.sidebarActiveBg,
                  color: selected ? (isMidnight ? "#0b1329" : tokens.sidebarActiveColor) : tokens.sidebarTextColor,
                  fontWeight: 700,
                  "&:hover": {
                    backgroundColor: tokens.sidebarActiveBg,
                  },
                },
                "&.Mui-selected::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 10,
                  bottom: 10,
                  width: 4,
                  borderRadius: "0 6px 6px 0",
                  backgroundColor: tokens.sidebarActiveIndicator,
                  boxShadow: isMidnight ? "0 0 10px rgba(0, 220, 130, 0.6)" : "none",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 42,
                  color: selected
                    ? (isMidnight ? "#00dc82" : tokens.primary)
                    : "inherit",
                }}
              >
                {item.icon}
              </ListItemIcon>

              <ListItemText
                primary={item.text}
                slotProps={{
                  primary: {
                    sx: {
                      fontWeight: selected ? 800 : 600,
                      fontSize: "0.95rem",
                    },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Box
        sx={{
          mt: "auto",
          px: 2,
          pb: 3,
        }}
      >
        <Divider sx={{ mb: 2.5, borderColor: tokens.cardBorder }} />

        <Box
          sx={{
            p: 2,
            borderRadius: 3,
            border: `1px solid ${tokens.sidebarFooterBorder}`,
            backgroundColor: tokens.sidebarFooterBg,
            boxShadow: isMidnight ? "0 8px 24px rgba(11, 19, 41, 0.12)" : "none",
            transition: "all 0.3s ease",
          }}
        >
          <Chip
            size="small"
            label="DEIK.AI Challenge 2026"
            sx={{
              mb: 1.25,
              color: isMidnight ? "#00dc82" : "#0f766e",
              backgroundColor: isMidnight
                ? "rgba(0, 220, 130, 0.15)"
                : "#d8f1ea",
              border: isMidnight ? "1px solid rgba(0, 220, 130, 0.3)" : "none",
              fontWeight: 700,
            }}
          />

          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mb: 0.5 }}>
            <Typography
              component="span"
              sx={{
                fontWeight: 900,
                fontSize: "1.05rem",
                color: isMidnight ? "#ffffff" : "#183d35",
              }}
            >
              GreenMind
            </Typography>
            <Typography
              component="span"
              sx={{
                fontWeight: 900,
                fontSize: "1.05rem",
                color: tokens.brandNameWord2,
              }}
            >
              AI
            </Typography>
          </Box>

          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: isMidnight ? "#94a3b8" : "#6b7f79",
              lineHeight: 1.4,
              fontSize: "0.75rem",
            }}
          >
            {tokens.brandTagline}
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}