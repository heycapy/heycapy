import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("service-worker"), serviceWorkers: "allow" });

const PAGE_CACHE = "heycapy-page";
const ASSET_CACHE = "heycapy-assets";

const isCached = (page: Page, cacheName: string, key: string) =>
  page.evaluate(
    async ([name, url]) => Boolean(await (await caches.open(name)).match(url)),
    [cacheName, key]
  );

const cachedAssetUrls = (page: Page) =>
  page.evaluate(async (name) => {
    const keys = await (await caches.open(name)).keys();
    return keys.map((request) => new URL(request.url).pathname);
  }, ASSET_CACHE);

// The first load registers the worker; the next one is the first it controls
async function openUnderWorker(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible();
}

test("the worker keeps the page, the offline page and the app's files", async ({ page }) => {
  await openUnderWorker(page);

  await expect.poll(() => isCached(page, PAGE_CACHE, "/")).toBe(true);
  await expect.poll(() => isCached(page, PAGE_CACHE, "/offline.html")).toBe(true);
  await expect
    .poll(async () => (await cachedAssetUrls(page)).some((p) => p.startsWith("/_next/static/")))
    .toBe(true);
});

test("logging out drops the kept page", async ({ page }) => {
  await openUnderWorker(page);
  await expect.poll(() => isCached(page, PAGE_CACHE, "/")).toBe(true);

  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "logout", exact: true }).click();
  await page
    .getByRole("dialog", { name: /log out\?/ })
    .getByRole("button", { name: /log out/ })
    .click();
  await expect(page).toHaveURL(/\/login$/);

  await expect.poll(() => isCached(page, PAGE_CACHE, "/")).toBe(false);
  await expect.poll(() => isCached(page, PAGE_CACHE, "/offline.html")).toBe(true);
});
