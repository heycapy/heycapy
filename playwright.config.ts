import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [["html", { outputFolder: "playwright-report" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testDir: "./tests/e2e/public",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Each spec here logs in as its own user (see global-setup.ts and helpers/auth.ts)
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
      "pnpm build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && cp -r src/lib/db/migrations .next/standalone/migrations && node .next/standalone/server.js",
    url: "http://localhost:3000",
    env: { E2E_TEST_MODE: "1" },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
