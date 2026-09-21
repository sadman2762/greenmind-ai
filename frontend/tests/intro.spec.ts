import { expect, test, type Page } from "@playwright/test";
import { campusReference, existingSensors, geoToScene } from "../src/components/intro/campusGeography";
import { FLIGHT_DURATION, connectionProgress } from "../src/components/intro/flightTokens";
import * as THREE from "three";
import { buildKassaiCampus, kassaiReferenceLayout } from "../src/components/intro/kassaiCampus";

const origin = process.env.GREENMIND_BASE_URL || "http://localhost:5173";
test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

async function freezeClock(page: Page) {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
}

async function ready(page: Page) {
  await page.goto(origin);
  await expect(page.locator(".flight-scene")).toHaveAttribute("data-scene-state", "ready", { timeout: 25000 });
}

async function visibleText(page: Page) {
  return page.locator(".intro-shell").evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const result: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest(".intro-sr-only, svg, style, script")) continue;
      const style = getComputedStyle(parent);
      if (style.display !== "none" && style.visibility !== "hidden" && parent.getBoundingClientRect().width > 1) {
        const text = node.textContent?.trim(); if (text) result.push(text);
      }
    }
    return result.join(" ");
  });
}

test("campus model includes the screenshot landmarks and front-facing DEIK glass lettering", () => {
  const parent = new THREE.Group();
  const surface = new THREE.MeshStandardMaterial();
  const label = new THREE.Texture();
  const trees: number[][] = [];
  const model = buildKassaiCampus(parent, { white: surface, cream: surface, concrete: surface, road: surface, path: surface, lawn: surface, glass: surface, darkGlass: surface }, (x, z) => trees.push([x, z]), label);
  expect(model.deik.userData.mainCourtyardCount).toBe(1);
  expect(model.lettering.userData.text).toBe("DEIK");
  expect(model.lettering.material.map).toBe(label);
  expect(model.lettering.position.toArray()).toEqual([...kassaiReferenceLayout.sign.position]);
  expect(new THREE.Vector3(0, 0, 1).applyEuler(model.lettering.rotation).z).toBeCloseTo(-1);
  for (const name of ["DEIK-open-courtyard", "Kassai-oval-courtyard-building", "Kassai-white-vaulted-sports-hall", "Kassai-circular-auditorium", "Kassai-modern-complex", "Kassai-central-historic-villa", "Kassai-long-orange-roof-hall"]) expect(parent.getObjectByName(name), name).toBeDefined();
  expect(parent.getObjectByName("Kassai-oval-courtyard-building")!.position.x).toBeLessThan(model.deik.position.x);
  expect(parent.getObjectByName("Kassai-white-vaulted-sports-hall")!.position.z).toBeGreaterThan(parent.getObjectByName("Kassai-oval-courtyard-building")!.position.z);
  expect(trees.length).toBeGreaterThan(50);
  model.dispose(); label.dispose(); surface.dispose();
});

test("DEIK target uses published coordinates and connects to exactly sixteen project stations", async ({ request }) => {
  expect(campusReference.entrance.lat).toBeCloseTo(47.5423833333, 9);
  expect(campusReference.entrance.lng).toBeCloseTo(21.63975, 9);
  expect(geoToScene(campusReference.entrance.lat, campusReference.entrance.lng)).toEqual([0, 0, -0]);
  expect(existingSensors).toHaveLength(16);
  expect(new Set(existingSensors.map((station) => station.id)).size).toBe(16);
  const response = await request.get(`${origin}/api/official-stations/`);
  expect(response.ok()).toBe(true);
  const data = await response.json();
  for (const station of existingSensors) expect(data.stations).toContainEqual(expect.objectContaining(station));
  expect(existingSensors.every((_, index) => connectionProgress(9.2, index) === 1)).toBe(true);
  expect(FLIGHT_DURATION).toBeGreaterThanOrEqual(10);
  expect(FLIGHT_DURATION).toBeLessThanOrEqual(12);
});

test("opening has clouds, no visible text or timeline, and no automatic sound or API requests", async ({ page }, testInfo) => {
  const errors: string[] = []; const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    const permitted = [new URL(origin).origin, "https://fonts.googleapis.com", "https://fonts.gstatic.com"];
    if (url.pathname.includes("/api/") || (url.protocol.startsWith("http") && !permitted.includes(url.origin))) requests.push(request.url());
  });
  await ready(page);
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "ready");
  await expect(page.getByRole("button", { name: "Play introduction", exact: true })).toBeEnabled();
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-sound", "on");
  expect(await visibleText(page)).toBe("");
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator(".flight-chapters, .flight-timecode, .flight-progress-track")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("01-opening-clouds.png") });
  expect(errors).toEqual([]); expect(requests).toEqual([]);
});

test("film follows the complete aerial-campus-network-cloud storyboard without captions", async ({ page }, testInfo) => {
  await freezeClock(page);
  await ready(page);
  const cloudSampleArea = { x: 50, y: 120, width: 280, height: 220 };
  const openingClouds = await page.screenshot({ clip: cloudSampleArea });
  await page.getByRole("button", { name: "Mute introduction" }).click({ force: true });
  await page.getByRole("button", { name: "Play introduction", exact: true }).click({ force: true });
  let previous = 0;
  for (const [at, phase, name] of [
    [0.9, "sky", "02-parting-clouds"],
    [2.3, "city", "03-debrecen-aerial"],
    [3.35, "campus", "04a-kassai-campus-overview"],
    [4.25, "campus", "04-kassai-campus"],
    [5.7, "blindspot", "05-deik-entrance"],
    [7.05, "sensor", "06-sensor-installed"],
    [9.3, "network", "07-sixteen-connections"],
    [10.15, "clouds", "08-closing-clouds"],
    [11.5, "logo", "09-greenmind-logo"],
  ] as const) {
    await page.clock.fastForward(Math.round((at - previous) * 1000)); previous = at;
    await expect(page.locator(".intro-shell")).toHaveAttribute("data-phase", phase);
    if (phase === "network") await expect(page.locator(".intro-shell")).toHaveAttribute("data-connected", "16");
    expect(await visibleText(page)).toBe(phase === "logo" ? "GreenMind AI" : "");
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  }
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "complete");
  const closingClouds = await page.screenshot({ clip: cloudSampleArea });
  expect(closingClouds.equals(openingClouds)).toBe(false);
});

test("the real-time film finishes and can replay", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Play introduction", exact: true }).click();
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "playing");
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "complete", { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "GreenMind AI" })).toBeVisible();
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-elapsed", "11.500");
  await page.getByRole("button", { name: "Replay introduction" }).click();
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "playing");
  await page.keyboard.press("Escape");
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "paused");
});

test("pause freezes the scene clock and resume continues", async ({ page }) => {
  await freezeClock(page); await ready(page);
  await page.getByRole("button", { name: "Mute introduction" }).click({ force: true });
  await page.getByRole("button", { name: "Play introduction", exact: true }).click({ force: true });
  await page.clock.fastForward(5500);
  await page.getByRole("button", { name: "Pause introduction" }).click({ force: true });
  const time = await page.locator(".intro-shell").getAttribute("data-elapsed");
  await page.clock.fastForward(3000);
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-elapsed", time!);
  await page.getByRole("button", { name: "Continue introduction" }).click({ force: true });
  await page.clock.fastForward(7000);
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "complete");
});

test("sound starts with the play gesture and audio resources close on navigation", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext; const contexts: AudioContext[] = [];
    (window as Window & { filmAudio: AudioContext[] }).filmAudio = contexts;
    window.AudioContext = class extends NativeAudioContext { constructor() { super(); contexts.push(this); } };
  });
  await ready(page);
  expect(await page.evaluate(() => (window as Window & { filmAudio: AudioContext[] }).filmAudio.length)).toBe(0);
  await page.getByRole("button", { name: "Play introduction", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { filmAudio: AudioContext[] }).filmAudio[0]?.state)).toBe("running");
  await page.getByRole("button", { name: "Mute introduction" }).click();
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-sound", "off");
  await page.getByRole("link", { name: "Enter workspace" }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { filmAudio: AudioContext[] }).filmAudio[0]?.state)).toBe("closed");
});

test("audio failure leaves no visible error captions and the film still completes", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "AudioContext", { value: undefined }); });
  await freezeClock(page); await ready(page);
  await page.getByRole("button", { name: "Play introduction", exact: true }).click({ force: true });
  await expect(page.getByRole("status")).toContainText("Sound is unavailable");
  expect(await visibleText(page)).toBe("");
  await page.clock.fastForward(12000);
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "complete");
});

test("reduced motion shows only the static final brand", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin);
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "static");
  await expect(page.getByRole("link", { name: "Enter GreenMind AI" })).toBeVisible();
  expect(await visibleText(page)).toBe("GreenMind AI");
  await expect(page.getByRole("button", { name: "Play introduction", exact: true })).toHaveCount(0);
});

test("motion preference changes stop playback safely", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Play introduction", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "static");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".intro-shell")).not.toHaveAttribute("data-state", "playing");
});

for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1366, 768]]) {
  test(`film and logo fit ${width}x${height} without scrolling`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height }); await freezeClock(page); await ready(page);
    await page.getByRole("button", { name: "Mute introduction" }).click({ force: true });
    await page.getByRole("button", { name: "Play introduction", exact: true }).click({ force: true });
    await page.clock.fastForward(12000);
    await expect(page.getByRole("heading", { name: "GreenMind AI" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewport: [innerWidth, innerHeight] }));
    expect(dimensions.width).toBeLessThanOrEqual(width); expect(dimensions.height).toBeLessThanOrEqual(height);
    await expect(page.getByRole("link", { name: "Enter workspace" })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`logo-${width}.png`) });
  });
}

test("WebGL failure still exposes the logo and workspace", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: () => null }); });
  await page.goto(origin);
  await expect(page.locator(".flight-scene")).toHaveAttribute("data-scene-state", "fallback");
  await expect(page.getByRole("img", { name: "Soft clouds surrounding the GreenMind AI introduction" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter GreenMind AI" })).toBeEnabled();
  expect(await visibleText(page)).toBe("GreenMind AI");
});

test("context loss stops playback and shows the final brand", async ({ page }) => {
  await ready(page); await page.getByRole("button", { name: "Play introduction", exact: true }).click();
  await page.locator(".flight-canvas").evaluate((canvas: HTMLCanvasElement) => canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext());
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "static");
  await expect(page.getByRole("link", { name: "Enter GreenMind AI" })).toBeVisible();
});

test("hidden tabs pause the film", async ({ page }) => {
  await ready(page); await page.getByRole("button", { name: "Play introduction", exact: true }).click();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "paused");
});

test("logo entry, immediate skip, and dashboard replay remain functional", async ({ page }) => {
  await page.goto(origin); await page.getByRole("link", { name: "Enter workspace" }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  await page.getByRole("link", { name: "Replay GreenMind intro" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("link", { name: "Enter GreenMind AI" }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  await expect(page.getByText("Official 30-Day Dataset", { exact: true })).toBeVisible();
});

test("icon-only controls have accessible names and keyboard focus", async ({ page }) => {
  await ready(page);
  const play = page.getByRole("button", { name: "Play introduction", exact: true });
  await play.focus(); await expect(play).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter"); await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "playing");
  await page.keyboard.press("Escape"); await expect(page.locator(".intro-shell")).toHaveAttribute("data-state", "paused");
});
