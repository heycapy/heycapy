import { test, expect } from "@playwright/test";

test("health endpoints answer without logging in", async ({ request }) => {
  const app = await request.get("/api/health", { maxRedirects: 0 });
  expect(app.status()).toBe(200);
  expect(await app.json()).toEqual({ status: "ok" });

  const scheduler = await request.get("/api/health/scheduler", { maxRedirects: 0 });
  expect(scheduler.status()).toBe(200);
  expect(await scheduler.json()).toMatchObject({ status: "ok", started: true });
});
