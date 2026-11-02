import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a SECOND backend instance on port 8001 backed by the `lamsa_test`
 * database (started with environment overrides, never the dev `.env` database), and a
 * dedicated admin dev server on port 5174 pointed at it. The normal dev pair
 * (backend 8000, admin 5173) is never touched. See README "End-to-end tests".
 */
const PORT = Number(process.env.E2E_ADMIN_PORT ?? 5174);
const API = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:8001/api/v1";
const MEDIA = process.env.E2E_MEDIA_BASE_URL ?? "http://127.0.0.1:8001/media";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    env: { VITE_API_BASE_URL: API, VITE_MEDIA_BASE_URL: MEDIA },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
