import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { E2E_DEPLOYMENT_ID } from "../helpers/env";

test.use({ storageState: authState("new-version") });

const banner = (page: Page) =>
  page.getByRole("status").filter({ hasText: "a new version of heycapy is out" });

test("the app hears its own version from the server and shows no banner", async ({ page }) => {
  await page.goto("/");

  const announced = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const source = new EventSource("/api/events");
        source.addEventListener("version", (e) => {
          source.close();
          resolve(e.data as string);
        });
      })
  );
  expect(announced).toBe(E2E_DEPLOYMENT_ID);
  await expect(banner(page)).toHaveCount(0);
});

test("a newer build on the server shows the banner, and refresh loads it", async ({ page }) => {
  await page.route("**/api/events", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: "event: version\ndata: a-newer-build\n\n",
    })
  );
  await page.goto("/");
  await expect(banner(page)).toBeVisible();

  await page.unroute("**/api/events");
  await banner(page).getByRole("button", { name: "[ refresh ]" }).click();
  await page.waitForLoadState("load");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});
