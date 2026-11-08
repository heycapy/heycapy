import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItem, createAndSelectBucket, itemRow, itemTick, uniqueName } from "../helpers/buckets";
import { field, openSettings, option, saveSettings } from "../helpers/settings";
import { enableWebhook, postItem } from "../helpers/webhook";
import { touchSwipe } from "../helpers/touch";

test.use({ storageState: authState("tick") });

test("the tick box finishes an item, and again reopens it", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Tick"));
  const title = uniqueName("water plants");
  await addItem(page, title);

  const tick = itemTick(page, title);
  await expect(tick).not.toBeChecked();
  await tick.click();
  await expect(tick).toBeChecked();
  await tick.click();
  await expect(tick).not.toBeChecked();
});

test("a read-only bucket's tick box can't be pressed", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Read only"));
  const title = uniqueName("read me");
  await addItem(page, title);
  const settings = await openSettings(page);
  await option(field(settings, "read only"), "on").click();
  await saveSettings(settings);

  await expect(itemTick(page, title)).toBeDisabled();
});

test("ticking an item in today takes it off the list", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Tick today"));
  const webhook = await enableWebhook(page);
  const title = uniqueName("call bank");
  const today = new Date().toLocaleDateString("en-CA");
  expect((await postItem(page.request, webhook, { title, deadline: today })).status()).toBe(201);
  await page.getByRole("button", { name: "today", exact: true }).click();

  const region = page.getByRole("region", { name: "today" });
  await region.getByRole("checkbox", { name: title, exact: true }).click();
  await expect(region.getByRole("button", { name: title })).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true });

  test("swiping a row either way does nothing", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "touch is driven through Chrome DevTools");
    await page.goto("/");
    await createAndSelectBucket(page, uniqueName("No swipe"));
    const title = uniqueName("water plants");
    await addItem(page, title);

    await touchSwipe(page, itemRow(page, title), 150);
    await expect(itemTick(page, title)).not.toBeChecked();
    await touchSwipe(page, itemRow(page, title), -150);
    await expect(page.getByRole("button", { name: "[ delete ]", exact: true })).toHaveCount(0);
    await expect(itemRow(page, title)).toBeVisible();
  });
});
