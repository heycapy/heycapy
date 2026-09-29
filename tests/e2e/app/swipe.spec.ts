import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItem, createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("swipe") });

async function swipe(page: Page, row: Locator, dx: number) {
  const box = await row.boundingBox();
  if (!box) throw new Error("row has no box");
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 5 });
  await page.mouse.move(x + dx, y, { steps: 5 });
  await page.mouse.up();
}

function statusDot(page: Page, title: string) {
  return itemRow(page, title)
    .locator("xpath=..")
    .getByRole("button", { name: /^status: / });
}

test("swiping right finishes an item, and again reopens it; a short swipe does nothing", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Swipe"));
  const title = uniqueName("water plants");
  await addItem(page, title);

  await swipe(page, itemRow(page, title), 40);
  await expect(statusDot(page, title)).toHaveAccessibleName("status: active");

  await swipe(page, itemRow(page, title), 150);
  await expect(statusDot(page, title)).toHaveAccessibleName("status: completed");

  await swipe(page, itemRow(page, title), 150);
  await expect(statusDot(page, title)).toHaveAccessibleName("status: active");
});

test("items in today can be swiped away, with undo", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Swipe today"));
  const webhook = await enableWebhook(page);
  const title = uniqueName("call bank");
  const today = new Date().toLocaleDateString("en-CA");
  expect((await postItem(page.request, webhook, { title, deadline: today })).status()).toBe(201);
  await page.getByRole("button", { name: "today", exact: true }).click();

  const row = page.getByRole("region", { name: "today" }).getByRole("button", { name: title });
  await swipe(page, row, -150);
  const swipeRow = row.locator("xpath=ancestor::div[contains(@class, 'overflow-hidden')][1]");
  await swipeRow.getByRole("button", { name: "[ delete ]", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: /undo/ }).click();
  await expect(row).toBeVisible();
});

test("the status menu opens above a row near the bottom of the screen", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Status menu"));
  const title = uniqueName("near the bottom");
  await addItem(page, title);

  const dot = statusDot(page, title);
  const dotBox = await dot.boundingBox();
  if (!dotBox) throw new Error("no dot");
  await page.setViewportSize({ width: 1280, height: Math.ceil(dotBox.y + dotBox.height + 40) });
  await dot.click();

  const menu = page.getByRole("menu", { name: "status" });
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(menuBox && viewport && menuBox.y + menuBox.height <= viewport.height).toBe(true);
  expect(menuBox && menuBox.y < dotBox.y).toBe(true);
});
