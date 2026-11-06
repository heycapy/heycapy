import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  activeBucketTitle,
  bucketTab,
  createAndSelectBucket,
  itemTick,
  openBucketOnPhone,
  uniqueName,
} from "../helpers/buckets";
import { settingsDialog } from "../helpers/settings";
import { daysFromNow, enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("bucket-tabs") });

function tabs(page: Page) {
  return page.getByRole("navigation", { name: "buckets" });
}

function gear(page: Page) {
  return page.getByRole("button", { name: "bucket settings", exact: true });
}

test("today and every bucket are tabs; the active one has the gear", async ({ page }) => {
  await page.goto("/");
  const first = uniqueName("Tab one");
  const second = uniqueName("Tab two");
  await createAndSelectBucket(page, first);
  await createAndSelectBucket(page, second);

  await expect(activeBucketTitle(page)).toHaveText(second);
  await expect(gear(page)).toHaveCount(1);
  await bucketTab(page, first).click();
  await expect(activeBucketTitle(page)).toHaveText(first);
  await expect(bucketTab(page, second)).not.toHaveAttribute("aria-current");

  await gear(page).click();
  await expect(settingsDialog(page)).toContainText(`bucket settings [${first}]`);
  await page.keyboard.press("Escape");
  await expect(settingsDialog(page)).toBeHidden();

  await tabs(page).getByRole("button", { name: "today", exact: true }).click();
  await expect(activeBucketTitle(page)).toHaveText("today");
  await expect(gear(page)).toHaveCount(0);

  await tabs(page).getByRole("button", { name: "new bucket", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Blank/ })).toBeVisible();
});

test("a late item marks its bucket and today, and the mark goes once it's done", async ({
  page,
}) => {
  await page.goto("/");
  const quiet = uniqueName("Quiet");
  await createAndSelectBucket(page, quiet);
  const bucket = uniqueName("Late");
  await createAndSelectBucket(page, bucket);
  const webhook = await enableWebhook(page);
  const late = uniqueName("late one");
  for (const body of [
    { title: late, deadline: daysFromNow(-2) },
    { title: uniqueName("later one"), deadline: daysFromNow(3) },
  ]) {
    expect((await postItem(page.request, webhook, body)).status()).toBe(201);
  }
  await page.reload();

  await expect(bucketTab(page, bucket)).toHaveAttribute("data-late", "true");
  await expect(bucketTab(page, bucket)).toHaveAccessibleDescription("has late items");
  await expect(tabs(page).getByRole("button", { name: "today", exact: true })).toHaveAttribute(
    "data-late",
    "true"
  );
  await expect(bucketTab(page, quiet)).not.toHaveAttribute("data-late");

  await itemTick(page, late).click();
  await expect(bucketTab(page, bucket)).not.toHaveAttribute("data-late");
});

test("the tabs stay at the top while a long list scrolls", async ({ page }) => {
  await page.goto("/");
  const bucket = uniqueName("Long");
  await createAndSelectBucket(page, bucket);
  const webhook = await enableWebhook(page);
  const last = uniqueName("item 30");
  for (let n = 1; n <= 30; n++) {
    const title = n === 30 ? last : uniqueName(`item ${n}`);
    expect((await postItem(page.request, webhook, { title })).status()).toBe(201);
  }
  await page.setViewportSize({ width: 390, height: 600 });
  await page.reload();

  await page.getByRole("button", { name: last }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: last })).toBeInViewport();
  await expect(bucketTab(page, bucket)).toBeInViewport();
  expect((await tabs(page).boundingBox())?.y).toBeLessThanOrEqual(60);
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true });

  test("the tabs scroll, search stays put, and every tab is easy to tap", async ({ page }) => {
    const names = [uniqueName("Scroll a"), uniqueName("Scroll b"), uniqueName("Scroll c")];
    await page.goto("/");
    for (const name of names) await createAndSelectBucket(page, name);
    await openBucketOnPhone(page, uniqueName("Scroll d"));
    await page.reload();

    const search = page.getByRole("button", { name: "search", exact: true });
    const before = await search.boundingBox();
    await expect(activeBucketTitle(page)).toBeInViewport();
    const today = tabs(page).getByRole("button", { name: "today", exact: true });
    await today.scrollIntoViewIfNeeded();
    await today.tap();
    await expect(activeBucketTitle(page)).toHaveText("today");
    expect(await search.boundingBox()).toEqual(before);

    for (const control of [search, today, bucketTab(page, names[0])]) {
      expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("your avatar opens the menu, and tweaks from it", async ({ page }) => {
    await openBucketOnPhone(page, uniqueName("Avatar"));
    await page.getByRole("button", { name: "your menu", exact: true }).tap();
    await page.getByRole("button", { name: "tweaks", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "tweaks" })).toBeVisible();
  });
});
