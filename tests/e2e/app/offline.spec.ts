import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  addItemButton,
  createAndSelectBucket,
  itemRow,
  itemTick,
  openItemMenu,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("offline") });

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

  await page.route("**/*", (route) =>
    route.request().headers()["next-action"] ? route.abort() : route.continue()
  );
  await page.reload();
  await expect(banner(page)).toBeVisible();

  await page.unroute("**/*");
  await page.reload();
  await expect(page.locator("main h2")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

const snapshotExists = (page: Page) =>
  page.evaluate(async () =>
    (await indexedDB.databases()).some((db) => db.name === "heycapy-snapshot")
  );

test("a bucket opens from the saved copy when its list can't be loaded", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("snapshot"));
  const title = uniqueName("saved item");
  await addItem(page, title);
  await expect(itemRow(page, title)).toBeVisible();

  await page.route("**/*", (route) =>
    route.request().headers()["next-action"] ? route.abort() : route.continue()
  );
  await page.reload();

  await expect(itemRow(page, title)).toBeVisible();
  await expect(banner(page)).toBeVisible();
});

test("logging out deletes the saved copy", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("snapshot"));
  await addItem(page, uniqueName("saved item"));
  await expect.poll(() => snapshotExists(page)).toBe(true);

  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "logout", exact: true }).click();
  await page
    .getByRole("dialog", { name: /log out\?/ })
    .getByRole("button", { name: /log out/ })
    .click();
  await expect(page).toHaveURL(/\/login$/);

  await expect.poll(() => snapshotExists(page)).toBe(false);
});

test("offline the list can be read but not changed, and comes back when online", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("read only"));
  const title = uniqueName("kept item");
  await addItem(page, title);

  await page.route("**/*", (route) =>
    route.request().headers()["next-action"] ? route.abort() : route.continue()
  );
  await page.reload();
  await expect(banner(page)).toBeVisible();
  await expect(itemRow(page, title)).toBeVisible();

  await expect(addItemButton(page)).toHaveCount(0);
  await expect(itemTick(page, title)).toBeDisabled();
  const menu = await openItemMenu(page, title);
  await expect(menu.getByRole("button", { name: "delete" })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "copy title" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.unroute("**/*");
  await page.reload();
  await expect(banner(page)).toHaveCount(0);
  await expect(addItemButton(page)).toBeVisible();
  await expect(itemTick(page, title)).toBeEnabled();
});
