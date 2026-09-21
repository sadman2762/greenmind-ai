import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Box } from "@mui/material";
import type { createCityScene } from "./createCityScene";

export type SceneStatus = "loading" | "ready" | "fallback";
export interface FlightControls {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
}
interface CitySceneProps {
  initialTime: number;
  onProgress: (time: number) => void;
  onPause: () => void;
  onStatus: (status: SceneStatus) => void;
}

function FlightFallback() {
  return (
    <svg className="flight-fallback" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Soft clouds surrounding the GreenMind AI introduction">
      <defs>
        <radialGradient id="intro-cloud"><stop stopColor="var(--surface-raised)" /><stop offset="1" stopColor="var(--surface-base)" stopOpacity="0" /></radialGradient>
        <linearGradient id="intro-sky" x2="0" y2="1"><stop stopColor="var(--surface-base)" /><stop offset="1" stopColor="var(--surface-raised)" /></linearGradient>
      </defs>
      <path fill="url(#intro-sky)" d="M0 0h1440v900H0z" />
      {Array.from({ length: 14 }, (_, index) => <ellipse key={index} cx={(index * 347) % 1600 - 80} cy={(index * 229) % 1000 - 50} rx="420" ry="220" fill="url(#intro-cloud)" />)}
    </svg>
  );
}

const CityScene = forwardRef<FlightControls, CitySceneProps>(function CityScene({ initialTime, onProgress, onPause, onStatus }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controller = useRef<ReturnType<typeof createCityScene> | null>(null);
  const [status, setStatus] = useState<SceneStatus>("loading");

  useImperativeHandle(ref, () => ({
    play: () => controller.current?.play(),
    pause: () => controller.current?.pause(),
    seek: (time) => controller.current?.seek(time),
  }), []);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fallback = () => {
      if (cancelled) return;
      controller.current?.dispose(); controller.current = null;
      setStatus("fallback"); onStatus("fallback"); onPause();
    };
    import("./createCityScene").then(({ createCityScene }) => {
      if (cancelled) return;
      try {
        controller.current = createCityScene(canvas, { initialTime, onProgress, onPause, onContextLost: fallback });
        onPause(); onProgress(initialTime);
        setStatus("ready"); onStatus("ready");
      } catch {
        fallback();
      }
    }).catch(fallback);
    return () => {
      cancelled = true;
      controller.current?.dispose(); controller.current = null;
    };
  }, [initialTime, onProgress, onPause, onStatus]);

  return (
    <Box className="flight-scene" data-scene-state={status}>
      {status !== "ready" && <FlightFallback />}
      <canvas ref={canvasRef} className="flight-canvas" style={{ visibility: status === "ready" ? "visible" : "hidden" }} role="img" aria-label="Stylized aerial film: clouds open over green Debrecen, descend to the published DEIK entrance at Kassai campus, illustrate a sensor placement and connections to sixteen project stations, then close around GreenMind AI. The building is an artistic reconstruction and the blind spot is fictional." />
    </Box>
  );
});

export default CityScene;
