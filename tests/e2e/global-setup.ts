import { readdirSync } from "node:fs";
import { chromium, request } from "@playwright/test";
import { login } from "./helpers/login";
import { APP_SPECS_DIR, authState, specUserEmail } from "./helpers/auth";

const BASE_URL = "http://localhost:3000";

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const reset = await ctx.post("/api/e2e/reset-auth");
  await ctx.dispose();
  if (!reset.ok()) {
    throw new Error(
      `Test auth reset failed (${reset.status()}). The server on ${BASE_URL} must run with E2E_TEST_MODE=1 — stop any other server on that port and let Playwright start it.`
    );
  }

  const specs = readdirSync(APP_SPECS_DIR)
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => f.replace(/\.spec\.ts$/, ""));

  const browser = await chromium.launch();
  for (const spec of specs) {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    await login(page, specUserEmail(spec));
    await context.storageState({ path: authState(spec) });
    await context.close();
  }
  await browser.close();
}
