import { mkdirSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Not 3000, so tests can run alongside `pnpm dev`
const E2E_PORT = 3100;
const BASE_URL = `http://localhost:${E2E_PORT}`;
// The server gets its own database, separate from dev; the build step keeps the default
mkdirSync(".e2e", { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [["html", { outputFolder: "playwright-report" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testDir: "./tests/e2e/public",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // One user per spec, see global-setup.ts
      name: "chromium-app",
      testDir: "./tests/e2e/app",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(process.env.CI
      ? [
          {
            name: "firefox",
            testDir: "./tests/e2e/public",
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            testDir: "./tests/e2e/public",
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),
  ],
  webServer: {
    command:
      "pnpm build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && cp -r src/lib/db/migrations .next/standalone/migrations && DATABASE_URL=file:$PWD/.e2e/heycapy.db node .next/standalone/server.js",
    url: BASE_URL,
    // Dummy keys override .env: channels count as configured, and nothing reaches real services
    env: {
      E2E_TEST_MODE: "1",
      RESEND_API_KEY: "e2e-not-used",
      TELEGRAM_BOT_TOKEN: "e2e-not-used",
      ADMIN_EMAILS: "e2e-system@heycapy.test",
      PORT: String(E2E_PORT),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
