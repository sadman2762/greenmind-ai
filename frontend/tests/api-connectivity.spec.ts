import { expect, test } from "@playwright/test";

const origins = ["http://localhost:5173", "http://127.0.0.1:5173"];
if (process.env.GREENMIND_PREVIEW_URL) origins.push(process.env.GREENMIND_PREVIEW_URL);

test.use({
  viewport: { width: 1440, height: 1000 },
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
});

for (const origin of origins) {
  test(`dashboard renders backend telemetry through ${origin}`, async ({ page }) => {
    const apiOrigins = new Set<string>();
    const failures: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/") || url.pathname === "/traffic") apiOrigins.add(url.origin);
    });
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/") || url.pathname === "/traffic") failures.push(request.url());
    });
    await page.goto(`${origin}/dashboard`);
    await expect(page.getByText("Official 30-Day Dataset", { exact: true })).toBeVisible({ timeout: 15000 });
    const analytics = await page.evaluate(async () => {
      const response = await fetch("/api/recommendations/ai-city-analytics");
      if (!response.ok) throw new Error(`Analytics HTTP ${response.status}`);
      return response.json();
    });
    await expect(page.getByText(analytics.cityHealth.headline, { exact: true })).toBeVisible();
    await expect(page.getByText("Could not load official dashboard telemetry.")).toHaveCount(0);
    await expect(page.getByText("Could not load the official dataset summary.")).toHaveCount(0);
    expect([...apiOrigins]).toEqual([new URL(origin).origin]);
    expect(failures).toEqual([]);
  });

  test(`read-only API endpoints return JSON through ${origin}`, async ({ page }) => {
    await page.goto(`${origin}/dashboard`);
    const responses = await page.evaluate(async () => {
      const endpoints = [
        "/api/health", "/api/official-stations/", "/traffic",
        "/api/official-dataset/summary", "/api/official-dataset/latest",
        "/api/recommendations/", "/api/recommendations/ai-city-analytics",
        "/api/sensor-health/", "/api/maintenance-orders/", "/api/copilot/status",
        "/api/data-quality/",
      ];
      return Promise.all(endpoints.map(async (path) => {
        const response = await fetch(path);
        return { path, status: response.status, contentType: response.headers.get("content-type"), data: await response.json() };
      }));
    });
    for (const response of responses) {
      expect(response.status, response.path).toBe(200);
      expect(response.contentType, response.path).toContain("application/json");
    }
    expect(responses.find((item) => item.path === "/api/official-stations/")?.data.stations.length).toBeGreaterThan(0);
    expect(responses.find((item) => item.path === "/traffic")?.data.locations.length).toBeGreaterThan(0);
    expect(responses.find((item) => item.path === "/api/official-dataset/summary")?.data.rows).toBeGreaterThan(0);
    expect(responses.find((item) => item.path === "/api/sensor-health/")?.data.stations.length).toBeGreaterThan(0);
  });
}
