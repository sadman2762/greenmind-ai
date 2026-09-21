import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Box, Button, CssBaseline, IconButton, Stack, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Link } from "react-router-dom";
import CityScene, { type FlightControls, type SceneStatus } from "../../components/intro/CityScene";
import { createFlightAudio } from "../../components/intro/flightAudio";
import { connectionProgress, FLIGHT_DURATION, LOGO_REVEAL_TIME, flightChapters, flightColors, flightPhase } from "../../components/intro/flightTokens";
import { existingSensors } from "../../components/intro/campusGeography";
import "./intro.css";

const AppShell = styled(Stack)({ minHeight: "100svh" });
const AppContainer = styled(Stack)({ flex: 1, position: "relative" });
const AppHeader = styled(Stack)({ position: "absolute", zIndex: 4 }) as typeof Stack;
const AppContent = styled(Stack)({ flex: 1, position: "relative" }) as typeof Stack;

const colorVariables = {
  "--surface-base": flightColors.sky,
  "--surface-raised": flightColors.cloud,
  "--color-cloud-shadow": flightColors.cloudShadow,
  "--color-primary": flightColors.deepGreen,
  "--color-accent": flightColors.green,
  "--color-foreground": flightColors.deepGreen,
} as CSSProperties;

function GreenMindMark() {
  return <svg className="intro-logo-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 5 17 25h9L10 43h17v15h10V43h17L38 25h9L32 5Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" /><path d="M32 20v29m0-16 8-8m-8 16-9-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="32" cy="18" r="2.1" fill="currentColor" /><circle cx="41" cy="25" r="2" fill="currentColor" /><circle cx="22" cy="31" r="2" fill="currentColor" /></svg>;
}

export default function Intro() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", { noSsr: true });
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioNotice, setAudioNotice] = useState("");
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("loading");
  const scene = useRef<FlightControls>(null);
  const audio = useRef<ReturnType<typeof createFlightAudio> | null>(null);
  const staticMode = reducedMotion || sceneStatus === "fallback";
  const displayedTime = staticMode ? FLIGHT_DURATION : time;
  const phase = flightPhase(displayedTime);
  const complete = displayedTime >= FLIGHT_DURATION;
  const showLogo = displayedTime >= LOGO_REVEAL_TIME;
  const running = playing && !staticMode;
  const state = staticMode ? "static" : running ? "playing" : complete ? "complete" : started ? "paused" : "ready";
  const logoProgress = Math.min(1, Math.max(0, (displayedTime - LOGO_REVEAL_TIME) / 0.55));
  const connected = existingSensors.filter((_, index) => connectionProgress(displayedTime, index) >= 1).length;

  const pause = useCallback(() => { setPlaying(false); audio.current?.stop(); }, []);

  useEffect(() => {
    const title = document.title;
    document.title = "GreenMind AI";
    return () => { document.title = title; audio.current?.dispose(); audio.current = null; };
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    scene.current?.pause(); audio.current?.stop();
  }, [reducedMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { scene.current?.pause(); pause(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pause]);

  function playAudio(offset: number) {
    try {
      if (!audio.current) audio.current = createFlightAudio();
      void audio.current.playFrom(offset).catch(() => {
        setSoundEnabled(false); setAudioNotice("Sound is unavailable. The introduction will continue silently.");
      });
    } catch {
      setSoundEnabled(false); setAudioNotice("Sound is unavailable. The introduction will continue silently.");
    }
  }

  function launch() {
    if (staticMode || sceneStatus !== "ready") return;
    const offset = complete ? 0 : time;
    if (complete) scene.current?.seek(0);
    setStarted(true); setPlaying(true); scene.current?.play();
    if (soundEnabled) playAudio(offset);
  }

  function toggleSound() {
    const enabled = !soundEnabled; setSoundEnabled(enabled); setAudioNotice("");
    if (!enabled) audio.current?.stop(); else if (running) playAudio(time);
  }

  const announcement = audioNotice || (staticMode ? "Static GreenMind AI introduction. Enter the workspace using the logo or arrow button." : !started ? "Play the eleven-and-a-half-second introduction with sound, or use the arrow to enter the workspace." : flightChapters.find((chapter) => chapter.id === phase)!.detail);

  return (
    <AppShell className="intro-shell" style={colorVariables} data-state={state} data-phase={phase} data-sound={soundEnabled ? "on" : "off"} data-connected={connected} data-elapsed={displayedTime.toFixed(3)}>
      <CssBaseline />
      <AppContainer className="intro-container">
        <AppHeader component="header" className="intro-controls" direction="row" spacing={1} aria-label="Introduction controls">
          {started && !staticMode && <IconButton className="intro-control" aria-label={running ? "Pause introduction" : complete ? "Replay introduction" : "Resume introduction"} onClick={running ? () => { scene.current?.pause(); pause(); } : launch}>{running ? <PauseRoundedIcon /> : complete ? <ReplayRoundedIcon /> : <PlayArrowRoundedIcon />}</IconButton>}
          <IconButton className="intro-control" aria-label={soundEnabled ? "Mute introduction" : "Enable sound"} aria-pressed={soundEnabled} disabled={staticMode} onClick={toggleSound}>{soundEnabled && !staticMode ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}</IconButton>
          <IconButton component={Link} to="/dashboard" className="intro-control" aria-label="Enter workspace"><ArrowForwardRoundedIcon /></IconButton>
        </AppHeader>
        <AppContent component="main" className="intro-content" aria-label="GreenMind AI introduction">
          <CityScene ref={scene} initialTime={reducedMotion ? FLIGHT_DURATION : 0} onProgress={setTime} onPause={pause} onStatus={setSceneStatus} />
          {!running && !showLogo && <IconButton className="intro-start" aria-label={started ? "Continue introduction" : "Play introduction"} aria-description="Starts the cinematic with sound unless muted. This is a stylized visualization, not a real sensor deployment." disabled={sceneStatus !== "ready"} onClick={launch}><PlayArrowRoundedIcon /></IconButton>}
          {showLogo && <Stack className="intro-finale" sx={{ alignItems: "center", justifyContent: "center" }} style={{ opacity: logoProgress, transform: `translateY(${(1 - logoProgress) * 10}px)` }}><Button component={Link} to="/dashboard" className="intro-logo-link" aria-label="Enter GreenMind AI"><GreenMindMark /><Typography component="h1" className="intro-wordmark">GreenMind <Box component="span">AI</Box></Typography></Button></Stack>}
          <Typography component="p" role="status" aria-live="polite" className="intro-sr-only">{announcement}</Typography>
        </AppContent>
      </AppContainer>
    </AppShell>
  );
}
