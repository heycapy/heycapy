import { readdirSync } from "node:fs";
import { chromium, request, type FullConfig } from "@playwright/test";
import { login } from "./helpers/login";
import { giveOwnSmtp } from "./helpers/email";
import { APP_SPECS_DIR, authState, specUserEmail } from "./helpers/auth";

const LOGINS_AT_ONCE = 8;

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error("playwright.config.ts must set use.baseURL");
  const ctx = await request.newContext({ baseURL });
  const reset = await ctx.post("/api/e2e/reset");
  await ctx.dispose();
  if (!reset.ok()) {
    throw new Error(
      `Test account reset failed (${reset.status()}). The server on ${baseURL} must run with E2E_TEST_MODE=1 — stop any other server on that port and let Playwright start it.`
    );
  }

  const specs = readdirSync(APP_SPECS_DIR)
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => f.replace(/\.spec\.ts$/, ""));

  const browser = await chromium.launch();
  const logIn = async (spec: string) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await login(page, specUserEmail(spec));
    giveOwnSmtp(specUserEmail(spec));
    await context.storageState({ path: authState(spec) });
    await context.close();
  };
  for (let i = 0; i < specs.length; i += LOGINS_AT_ONCE) {
    await Promise.all(specs.slice(i, i + LOGINS_AT_ONCE).map(logIn));
  }
  await browser.close();
}
