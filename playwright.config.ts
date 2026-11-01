import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: `http://127.0.0.1:${PORT}/login`,
    env: {
      VITE_API_BASE_URL:
        process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1",
      VITE_MEDIA_BASE_URL:
        process.env.VITE_MEDIA_BASE_URL ?? "http://127.0.0.1:8000/media",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
