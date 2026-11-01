import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
    env: {
      VITE_API_BASE_URL: "http://127.0.0.1:8000/api/v1",
      VITE_MEDIA_BASE_URL: "http://127.0.0.1:8000/media",
    },
  },
});
