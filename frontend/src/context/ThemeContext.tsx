import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
} from "@mui/material/styles";
import {
  midnightTheme,
  THEMES,
  type ThemeMode,
  type ThemeTokens,
} from "../theme/themeTokens";

interface ThemeContextType {
  mode: ThemeMode;
  tokens: ThemeTokens;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isMidnight: boolean;
}

const STORAGE_KEY = "greenmind_theme_mode";

const ThemeContext = createContext<ThemeContextType>({
  mode: "midnight",
  tokens: midnightTheme,
  setThemeMode: () => {},
  toggleTheme: () => {},
  isMidnight: true,
});

export function ThemeCustomProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "classic" || saved === "midnight") {
        return saved;
      }
    } catch {
      // fallback
    }
    return "midnight"; // Default to midnight theme requested by user
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const tokens = useMemo(() => THEMES[mode] || midnightTheme, [mode]);

  const muiTheme = useMemo(() => {
    const isMid = mode === "midnight";

    return createTheme({
      palette: {
        mode: "light", // Keep most parts white as requested!
        primary: {
          main: isMid ? "#0b1329" : "#0f766e",
          dark: isMid ? "#070c1a" : "#042f2e",
          light: isMid ? "#1e293b" : "#14b8a6",
          contrastText: "#ffffff",
        },
        secondary: {
          main: isMid ? "#00dc82" : "#16a34a",
          dark: isMid ? "#00c571" : "#15803d",
          light: isMid ? "#5ef2b4" : "#4ade80",
          contrastText: isMid ? "#0b1329" : "#ffffff",
        },
        background: {
          default: isMid ? "#f8fafc" : "#f4f8f6",
          paper: "#ffffff",
        },
        text: {
          primary: isMid ? "#0f172a" : "#14332d",
          secondary: isMid ? "#475569" : "#44534f",
        },
        divider: isMid ? "rgba(15, 23, 42, 0.08)" : "rgba(15, 118, 110, 0.12)",
      },
      typography: {
        fontFamily:
          '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        h6: {
          fontWeight: 800,
        },
        subtitle1: {
          fontWeight: 700,
        },
        button: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              borderRadius: 16,
              backgroundImage: "none",
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              boxShadow: "none",
              "&:hover": {
                boxShadow: "0 4px 12px rgba(11, 19, 41, 0.08)",
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              fontWeight: 600,
            },
          },
        },
      },
    });
  }, [mode]);

  function toggleTheme() {
    setMode((prev) => (prev === "midnight" ? "classic" : "midnight"));
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        tokens,
        setThemeMode: setMode,
        toggleTheme,
        isMidnight: mode === "midnight",
      }}
    >
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeCustomProvider");
  }
  return context;
}
