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

// On a real deploy Next.js turns any refresh against the newer server into a full page reload,
// so once the page knows it's out of date it waits for the person to press refresh
async function serverRefreshesAfter(page: Page, version: string): Promise<number> {
  await page.route("**/api/events", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: `event: version\ndata: ${version}\n\ndata: refresh\n\n`,
    })
  );
  let refreshes = 0;
  page.on("request", (request) => {
    if (request.headers()["rsc"] === "1") refreshes++;
  });
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await page.waitForTimeout(1000);
  return refreshes;
}

test("live updates keep coming on the same version", async ({ page }) => {
  expect(await serverRefreshesAfter(page, E2E_DEPLOYMENT_ID)).toBeGreaterThan(0);
});

test("a newer build stops live updates until refresh is pressed", async ({ page }) => {
  expect(await serverRefreshesAfter(page, "a-newer-build")).toBe(0);
  await expect(banner(page)).toBeVisible();
});
