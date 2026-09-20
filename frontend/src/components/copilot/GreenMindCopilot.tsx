import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Chip,
  CircularProgress,
  Tooltip,
  Fade,
  Badge,
  Divider,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import SchoolIcon from "@mui/icons-material/School";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import BalanceIcon from "@mui/icons-material/Balance";
import DescriptionIcon from "@mui/icons-material/Description";

import {
  sendCopilotChat,
  type CopilotMessage,
} from "../../services/copilotService";
import { useSimulation } from "../../context/SimulationContext";
import { useAppTheme } from "../../context/ThemeContext";


const DEFAULT_SUGGESTIONS = [
  {
    icon: <SchoolIcon sx={{ fontSize: 15 }} />,
    text: "How to allocate €50k for school protection?",
  },
  {
    icon: <BalanceIcon sx={{ fontSize: 15 }} />,
    text: "Explain Reference vs IoT Mesh hardware trade-offs",
  },
  {
    icon: <PrecisionManufacturingIcon sx={{ fontSize: 15 }} />,
    text: "Assess Southern Industrial Zone pollution risks",
  },
  {
    icon: <DescriptionIcon sx={{ fontSize: 15 }} />,
    text: "Draft a 1-page Debrecen City Council briefing",
  },
];

const INITIAL_GREETING: CopilotMessage = {
  role: "assistant",
  content: `👋 **Welcome to GreenMind Copilot!**

I am your **Debrecen Urban Environmental & Municipal Decision-Support AI**, connected directly to your live sensor grid and budget optimizer.

**I can assist you with:**
* **Real-time Air Quality Insights**: Analyzing PM2.5, PM10, NO2, O3 trends across Debrecen districts.
* **Hardware & Budget Decisions**: Comparing EN Reference (€28k), Mid-Tier Micro (€6.5k), and IoT Mesh (€1.2k) nodes.
* **What-If Coverage Simulations**: Evaluating new sensor positions and coverage halos.
* **Municipal Briefings & Policy**: Drafting reports, regulatory compliance assessments, and procurement dossiers.

*Ask me anything below or pick a quick topic to start!*`,
  timestamp: Date.now(),
};

// Simple Markdown Renderer for clean formatted output
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <Box key={idx} sx={{ height: 4 }} />;
        }

        // Headers
        if (trimmed.startsWith("### ")) {
          return (
            <Typography
              key={idx}
              variant="subtitle2"
              sx={{ fontWeight: 800, color: "#0f766e", mt: 0.5 }}
            >
              {renderBoldText(trimmed.replace(/^###\s*/, ""))}
            </Typography>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <Typography
              key={idx}
              variant="subtitle1"
              sx={{ fontWeight: 800, color: "#064e3b", mt: 0.5 }}
            >
              {renderBoldText(trimmed.replace(/^##\s*/, ""))}
            </Typography>
          );
        }

        // Bullet points
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          return (
            <Box
              key={idx}
              sx={{ display: "flex", alignItems: "flex-start", gap: 1, pl: 0.5 }}
            >
              <Typography
                component="span"
                sx={{ color: "#0f766e", fontWeight: 900, lineHeight: 1.4 }}
              >
                •
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "#334155", fontSize: "0.85rem", lineHeight: 1.45 }}
              >
                {renderBoldText(trimmed.replace(/^[\*\-]\s*/, ""))}
              </Typography>
            </Box>
          );
        }

        // Regular text
        return (
          <Typography
            key={idx}
            variant="body2"
            sx={{ color: "#334155", fontSize: "0.85rem", lineHeight: 1.45 }}
          >
            {renderBoldText(line)}
          </Typography>
        );
      })}
    </Box>
  );
}

// Helper to format **bold** and `code` inline
function renderBoldText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ fontWeight: 800, color: "#0f172a" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            backgroundColor: "#f1f5f9",
            padding: "1px 4px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            color: "#0f766e",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function GreenMindCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([INITIAL_GREETING]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { simulatedStations } = useSimulation();
  const { tokens, isMidnight } = useAppTheme();

  useEffect(() => {

    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  async function handleSendMessage(textToSend?: string) {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMessage: CopilotMessage = {
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputQuery("");
    setIsLoading(true);

    try {
      const clientContext = {
        currentPage: window.location.pathname,
        totalSimulatedStations: simulatedStations.length,
        customPinsCount: simulatedStations.filter((s) => s.isCustom).length,
        simulatedStationsRoster: simulatedStations.map((s) => ({
          name: s.name,
          tier: s.sensorTier || "iot",
          capex: s.unitCost || 1200,
          coordinates: [s.lat, s.lng],
          isCustom: !!s.isCustom,
        })),
        totalSimulatedCapex: simulatedStations.reduce((sum, s) => sum + (s.unitCost || 1200), 0),
      };

      const result = await sendCopilotChat(newHistory, clientContext);

      const assistantMessage: CopilotMessage = {
        role: "assistant",
        content: result.reply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(
          result.suggestions.map((s) => ({
            icon: <AutoAwesomeIcon sx={{ fontSize: 14 }} />,
            text: s,
          })),
        );
      }
    } catch (err) {
      const errorMessage: CopilotMessage = {
        role: "assistant",
        content: `⚠️ **Copilot Connection Error**: ${err instanceof Error ? err.message : "Failed to reach AI service."}\n\nPlease check that your OpenAI key is configured properly in \`backend/.env\`.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleClearChat() {
    setMessages([INITIAL_GREETING]);
    setSuggestions(DEFAULT_SUGGESTIONS);
  }

  function handleCopyMessage(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <Fade in={!isOpen}>
          <Box
            sx={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 1300,
            }}
          >
            <Badge
              color="success"
              variant="dot"
              overlap="circular"
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              sx={{
                "& .MuiBadge-badge": {
                  boxShadow: "0 0 0 2px white",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                },
              }}
            >
              <Paper
                elevation={6}
                onClick={() => setIsOpen(true)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 2.25,
                  py: 1.25,
                  borderRadius: 8,
                  backgroundColor: tokens.copilotTriggerBg,
                  color: tokens.copilotTriggerColor,
                  cursor: "pointer",
                  boxShadow: tokens.copilotTriggerShadow,
                  border: isMidnight ? "1px solid rgba(0, 220, 130, 0.3)" : "none",
                  transition: "all 0.25s ease",
                  "&:hover": {
                    backgroundColor: isMidnight ? "#1e293b" : "#0d655e",
                    transform: "translateY(-3px)",
                    boxShadow: isMidnight
                      ? "0 12px 36px rgba(0, 220, 130, 0.35)"
                      : "0 12px 30px rgba(15, 118, 110, 0.5)",
                  },
                }}
              >
                <SmartToyIcon sx={{ fontSize: 24, color: isMidnight ? "#00dc82" : "inherit" }} />
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 900, lineHeight: 1.2, letterSpacing: 0.3 }}
                  >
                    GreenMind Copilot
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.68rem",
                      color: isMidnight ? "#94a3b8" : "#ccfbf1",
                      display: "block",
                      fontWeight: 600,
                    }}
                  >
                    Debrecen Urban AI
                  </Typography>
                </Box>
              </Paper>
            </Badge>
          </Box>
        </Fade>
      )}

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <Fade in={isOpen}>
          <Paper
            elevation={12}
            sx={{
              position: "fixed",
              bottom: { xs: 0, sm: 24 },
              right: { xs: 0, sm: 24 },
              width: {
                xs: "100vw",
                sm: isExpanded ? 720 : 420,
              },
              height: {
                xs: "100vh",
                sm: isExpanded ? "85vh" : 620,
              },
              maxHeight: "90vh",
              borderRadius: { xs: 0, sm: 3.5 },
              overflow: "hidden",
              zIndex: 1400,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#ffffff",
              border: `1px solid ${tokens.cardBorder}`,
              boxShadow: "0 20px 45px rgba(11, 19, 41, 0.25)",
              transition: "width 0.25s ease, height 0.25s ease",
            }}
          >
            {/* Drawer Header */}
            <Box
              sx={{
                p: 2,
                background: isMidnight
                  ? "linear-gradient(135deg, #0b1329 0%, #1e293b 100%)"
                  : "linear-gradient(135deg, #0f766e 0%, #064e3b 100%)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
                borderBottom: isMidnight ? "1px solid rgba(0, 220, 130, 0.2)" : "none",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 2,
                    backgroundColor: isMidnight
                      ? "rgba(0, 220, 130, 0.15)"
                      : "rgba(255, 255, 255, 0.15)",
                    border: isMidnight ? "1px solid rgba(0, 220, 130, 0.3)" : "none",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SmartToyIcon sx={{ color: isMidnight ? "#00dc82" : "#5eead4", fontSize: 24 }} />
                </Box>

                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                      GreenMind Copilot
                    </Typography>
                    <Chip
                      size="small"
                      label="GPT-4o"
                      sx={{
                        height: 18,
                        fontSize: "0.62rem",
                        fontWeight: 800,
                        backgroundColor: isMidnight ? "#00dc82" : "#14b8a6",
                        color: isMidnight ? "#0b1329" : "#ffffff",
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isMidnight ? "#94a3b8" : "#99f6e4",
                      fontSize: "0.7rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <span style={{ color: "#00dc82" }}>●</span> Connected to Debrecen Sensor Grid
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Tooltip title="Clear chat history" arrow>
                  <IconButton
                    size="small"
                    onClick={handleClearChat}
                    sx={{ color: "rgba(255, 255, 255, 0.8)", "&:hover": { color: "#ffffff" } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title={isExpanded ? "Restore size" : "Expand window"} arrow>
                  <IconButton
                    size="small"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    sx={{
                      color: "rgba(255, 255, 255, 0.8)",
                      "&:hover": { color: "#ffffff" },
                      display: { xs: "none", sm: "inline-flex" },
                    }}
                  >
                    {isExpanded ? (
                      <CloseFullscreenIcon fontSize="small" />
                    ) : (
                      <OpenInFullIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>

                <Tooltip title="Close Copilot" arrow>
                  <IconButton
                    size="small"
                    onClick={() => setIsOpen(false)}
                    sx={{ color: "rgba(255, 255, 255, 0.8)", "&:hover": { color: "#ffffff" } }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Live Context Banner */}
            <Box
              sx={{
                px: 2,
                py: 0.85,
                backgroundColor: "#f0fdfa",
                borderBottom: "1px solid #ccfbf1",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <Chip
                  size="small"
                  label={`📍 ${window.location.pathname === "/" ? "Dashboard" : window.location.pathname.replace("/", "")}`}
                  sx={{
                    height: 20,
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    backgroundColor: "#ccfbf1",
                    color: "#0f766e",
                  }}
                />
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ color: "#0d9488", fontWeight: 700, fontSize: "0.72rem" }}
                >
                  {simulatedStations.length > 0
                    ? `📡 ${simulatedStations.length} simulated stations (€${simulatedStations.reduce((acc, s) => acc + (s.unitCost || 1200), 0).toLocaleString()})`
                    : "🔒 Strictly grounded to GreenMind AI & Debrecen"}
                </Typography>
              </Box>
            </Box>

            {/* Chat Messages Stream */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                p: 2,
                backgroundColor: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              {messages.map((msg, index) => {
                const isUser = msg.role === "user";

                return (
                  <Box
                    key={index}
                    sx={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        maxWidth: "88%",
                        p: 1.75,
                        borderRadius: 3,
                        borderTopRightRadius: isUser ? 0 : 3,
                        borderTopLeftRadius: isUser ? 3 : 0,
                        backgroundColor: isUser ? "#0f766e" : "#ffffff",
                        color: isUser ? "#ffffff" : "#1e293b",
                        border: isUser ? "none" : "1px solid #e2e8f0",
                        boxShadow: isUser
                          ? "0 4px 12px rgba(15, 118, 110, 0.25)"
                          : "0 2px 8px rgba(0, 0, 0, 0.04)",
                        position: "relative",
                        "&:hover .copy-btn": { opacity: 1 },
                      }}
                    >
                      {!isUser ? (
                        <>
                          <FormattedMessage content={msg.content} />
                          <IconButton
                            className="copy-btn"
                            size="small"
                            onClick={() => handleCopyMessage(msg.content, index)}
                            sx={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              opacity: 0,
                              transition: "opacity 0.2s",
                              color: "#64748b",
                              p: 0.5,
                            }}
                            title="Copy response"
                          >
                            {copiedIndex === index ? (
                              <CheckIcon sx={{ fontSize: 15, color: "#059669" }} />
                            ) : (
                              <ContentCopyIcon sx={{ fontSize: 15 }} />
                            )}
                          </IconButton>
                        </>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ fontSize: "0.88rem", lineHeight: 1.45, fontWeight: 500 }}
                        >
                          {msg.content}
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                );
              })}

              {isLoading && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      backgroundColor: "#ffffff",
                      px: 2,
                      py: 1,
                      borderRadius: 3,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <CircularProgress size={16} sx={{ color: "#0f766e" }} />
                    <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700 }}>
                      GreenMind Copilot is analyzing Debrecen data...
                    </Typography>
                  </Box>
                </Box>
              )}

              <div ref={messagesEndRef} />
            </Box>

            {/* Quick Suggestions Chips */}
            <Box
              sx={{
                p: 1.25,
                backgroundColor: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                flexWrap: "nowrap",
                overflowX: "auto",
                gap: 0.75,
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {suggestions.map((item, idx) => (
                <Chip
                  key={idx}
                  size="small"
                  icon={item.icon}
                  label={item.text}
                  clickable
                  onClick={() => handleSendMessage(item.text)}
                  disabled={isLoading}
                  sx={{
                    flexShrink: 0,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    backgroundColor: "#f0fdfa",
                    color: "#0f766e",
                    border: "1px solid #99f6e4",
                    "&:hover": {
                      backgroundColor: "#ccfbf1",
                      borderColor: "#0f766e",
                    },
                  }}
                />
              ))}
            </Box>

            <Divider />

            {/* Input Bar */}
            <Box
              sx={{
                p: 1.5,
                backgroundColor: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={3}
                placeholder="Ask about air quality, budget allocation, or council reports..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2.5,
                    fontSize: "0.85rem",
                    backgroundColor: "#f8fafc",
                    "&.Mui-focused": {
                      backgroundColor: "#ffffff",
                      boxShadow: "0 0 0 2px rgba(15, 118, 110, 0.2)",
                    },
                  },
                }}
              />

              <IconButton
                color="primary"
                onClick={() => handleSendMessage()}
                disabled={!inputQuery.trim() || isLoading}
                sx={{
                  width: 40,
                  height: 40,
                  backgroundColor: inputQuery.trim() ? "#0f766e" : "#e2e8f0",
                  color: "#ffffff",
                  "&:hover": {
                    backgroundColor: "#0d655e",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: "#f1f5f9",
                    color: "#94a3b8",
                  },
                }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Box>
          </Paper>
        </Fade>
      )}
    </>
  );
}