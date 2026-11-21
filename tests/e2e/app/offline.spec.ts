import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  createAndSelectBucket,
  itemRow,
  itemTick,
  openItemMenu,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("offline") });

// Server actions and the sync calls are what reach the server: the page itself still loads
const blockServer = (page: Page) =>
  page.route("**/*", (route) => {
    const request = route.request();
    const isSync = new URL(request.url()).pathname.startsWith("/api/v1/sync/");
    return request.headers()["next-action"] || isSync ? route.abort() : route.continue();
  });

const banner = (page: Page) => page.getByRole("status").filter({ hasText: "can't reach heycapy" });

test("going offline shows the notice and coming back removes it", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  await context.setOffline(true);
  await expect(banner(page)).toBeVisible();

  await context.setOffline(false);
  await expect(banner(page)).toHaveCount(0);
});

test("a list that can't load shows the notice, and a later load removes it", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("offline"));

  await blockServer(page);
  await page.reload();
  await expect(banner(page)).toBeVisible();

  await page.unroute("**/*");
  await page.reload();
  await expect(page.locator("main h2")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

const syncDatabaseExists = (page: Page) =>
  page.evaluate(async () => (await indexedDB.databases()).some((db) => db.name === "heycapy-sync"));

test("a bucket opens from the saved copy when its list can't be loaded", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("snapshot"));
  const title = uniqueName("saved item");
  await addItem(page, title);
  await expect(itemRow(page, title)).toBeVisible();

  await blockServer(page);
  await page.reload();

  await expect(itemRow(page, title)).toBeVisible();
  await expect(banner(page)).toBeVisible();
});

test("logging out deletes the copy on the device", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("snapshot"));
  await addItem(page, uniqueName("saved item"));
  await expect.poll(() => syncDatabaseExists(page)).toBe(true);

  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "logout", exact: true }).click();
  await page
    .getByRole("dialog", { name: /log out\?/ })
    .getByRole("button", { name: /log out/ })
    .click();
  await expect(page).toHaveURL(/\/login$/);

  await expect.poll(() => syncDatabaseExists(page)).toBe(false);
});

// What the server holds for this person, read the way a device downloads it
const serverTitles = (page: Page) =>
  page.evaluate(async () => {
    const response = await fetch("/api/v1/sync/pull?cursor=0&limit=1000", {
      headers: { "x-sync-protocol": "1" },
    });
    const body = (await response.json()) as {
      records: {
        entity: string;
        data: { title?: string; status?: string; deletedAt?: string | null };
      }[];
    };
    return body.records
      .filter((r) => r.entity === "item")
      .map((r) => `${r.data.title}:${r.data.status}${r.data.deletedAt ? ":trashed" : ""}`);
  });

test("offline an item can be added, ticked and deleted, and the server gets them when online", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("offline writes"));
  const kept = uniqueName("kept item");
  const doomed = uniqueName("doomed item");
  await addItem(page, kept);
  await addItem(page, doomed);
  await expect.poll(() => serverTitles(page)).toContain(`${kept}:active`);

  await blockServer(page);
  await page.reload();
  await expect(banner(page)).toBeVisible();
  await expect(itemRow(page, kept)).toBeVisible();

  const added = uniqueName("added offline");
  await addItem(page, added);
  await itemTick(page, kept).click();
  await expect(itemTick(page, kept)).toBeChecked();
  const menu = await openItemMenu(page, doomed);
  await expect(menu.getByRole("button", { name: /^reminders/ })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "tomorrow" })).toHaveCount(0);
  await menu.getByRole("button", { name: "delete" }).click();
  await expect(itemRow(page, doomed)).toHaveCount(0);

  await page.unroute("**/*");
  await page.reload();
  await expect(banner(page)).toHaveCount(0);
  await expect(itemRow(page, added)).toBeVisible();
  await expect
    .poll(() => serverTitles(page))
    .toEqual(
      expect.arrayContaining([`${added}:active`, `${kept}:completed`, `${doomed}:active:trashed`])
    );
});

test("logging out says how many changes have not reached the server", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("unsent"));
  await blockServer(page);
  await addItem(page, uniqueName("only here"));

  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "logout", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /log out\?/ });
  await expect(
    dialog.getByText("1 change hasn't reached the server and will be lost.")
  ).toBeVisible();
  await dialog.getByRole("button", { name: "cancel" }).click();
  await page.unroute("**/*");
});

test("a server that no longer speaks this version of sync asks for a refresh", async ({ page }) => {
  await page.route("**/api/v1/sync/**", (route) =>
    route.fulfill({
      status: 426,
      json: { error: "Update the app to keep syncing", minProtocol: 2 },
    })
  );
  await page.goto("/");
  await expect(
    page.getByRole("status").filter({ hasText: "a new version of heycapy is out" })
  ).toBeVisible();
});
