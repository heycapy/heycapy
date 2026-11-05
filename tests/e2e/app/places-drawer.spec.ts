import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  activeBucketTitle,
  addItemButton,
  createAndSelectBucket,
  openBucketOnPhone,
  uniqueName,
} from "../helpers/buckets";
import { settingsDialog } from "../helpers/settings";
import { daysFromNow, enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("places-drawer") });

function drawer(page: Page) {
  return page.getByRole("dialog", { name: "buckets", exact: true });
}

async function openDrawer(page: Page, place: string) {
  await page.getByRole("button", { name: `buckets: ${place}`, exact: true }).click();
  await expect(drawer(page)).toBeVisible();
  return drawer(page);
}

function placeRow(page: Page, name: string) {
  return drawer(page).getByRole("button", { name, exact: true });
}

test.describe("on a phone", () => {
  test.use({ hasTouch: true });

  test("the heading opens the drawer: today, a bucket, a new bucket", async ({ page }) => {
    const bucket = uniqueName("Drawer");
    await openBucketOnPhone(page, bucket);

    await page.getByRole("button", { name: `buckets: ${bucket}`, exact: true }).tap();
    await placeRow(page, "today").tap();
    await expect(drawer(page)).toBeHidden();
    await expect(page.getByRole("heading", { name: "today" })).toBeVisible();
    await expect(addItemButton(page)).toHaveCount(1);

    await page.getByRole("button", { name: "buckets: today", exact: true }).tap();
    await placeRow(page, bucket).tap();
    await expect(activeBucketTitle(page)).toHaveText(bucket);
    await expect(addItemButton(page)).toHaveCount(1);

    await page.getByRole("button", { name: `buckets: ${bucket}`, exact: true }).tap();
    await placeRow(page, "new bucket").tap();
    await expect(page.getByRole("button", { name: /^Blank/ })).toBeVisible();
  });

  test("the drawer fills from the bottom: today lowest, then the first bucket, trash on top", async ({
    page,
  }) => {
    const first = uniqueName("Order one");
    const second = uniqueName("Order two");
    await page.goto("/");
    await createAndSelectBucket(page, first);
    await createAndSelectBucket(page, second);
    await page.setViewportSize({ width: 390, height: 844 });
    await openDrawer(page, second);

    const tops: number[] = [];
    for (const name of [
      "trash",
      "archive",
      "join a bucket",
      "new bucket",
      second,
      first,
      "today",
    ]) {
      const box = await placeRow(page, name).boundingBox();
      tops.push(box?.y ?? -1);
    }
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    const today = await placeRow(page, "today").boundingBox();
    expect((today?.y ?? 0) + (today?.height ?? 0)).toBeGreaterThan(844 - 80);
    await expect(placeRow(page, second)).toHaveAttribute("aria-current", "page");
  });
});

test("a list taller than the screen opens at today and still scrolls up to trash", async ({
  page,
}) => {
  const first = uniqueName("Tall one");
  const second = uniqueName("Tall two");
  await page.goto("/");
  await createAndSelectBucket(page, first);
  await createAndSelectBucket(page, second);
  await page.setViewportSize({ width: 390, height: 280 });
  await openDrawer(page, second);

  await expect(placeRow(page, "today")).toBeInViewport();
  await expect(placeRow(page, "trash")).not.toBeInViewport();
  await placeRow(page, "trash").click();
  await expect(page.getByRole("dialog", { name: "trash" })).toBeVisible();
});

test("each bucket shows its open and late items, and today what it lists", async ({ page }) => {
  await page.goto("/");
  const bucket = uniqueName("Counts");
  await createAndSelectBucket(page, bucket);
  const webhook = await enableWebhook(page);
  for (const [title, deadline] of [
    ["late one", daysFromNow(-2)],
    ["later one", daysFromNow(3)],
    ["undated one", undefined],
  ] as const) {
    const body = deadline ? { title: uniqueName(title), deadline } : { title: uniqueName(title) };
    expect((await postItem(page.request, webhook, body)).status()).toBe(201);
  }
  expect(
    (
      await postItem(page.request, webhook, { title: uniqueName("done"), status: "completed" })
    ).status()
  ).toBe(201);

  await openDrawer(page, bucket);
  await expect(placeRow(page, bucket).locator("xpath=..")).toContainText("1 late · 3");
});

test("the gear opens that bucket's settings, from anywhere", async ({ page }) => {
  await page.goto("/");
  const bucket = uniqueName("Gear");
  await createAndSelectBucket(page, bucket);
  await page.getByRole("button", { name: "today", exact: true }).click();

  await openDrawer(page, "today");
  await drawer(page)
    .getByRole("button", { name: `${bucket} settings`, exact: true })
    .click();
  await expect(drawer(page)).toBeHidden();
  await expect(settingsDialog(page)).toContainText(`bucket settings [${bucket}]`);
  await expect(activeBucketTitle(page)).toHaveText(bucket);
});

test("trash, archive and join open from the drawer, escape closes it", async ({ page }) => {
  await page.goto("/");
  const bucket = uniqueName("Sheets");
  await createAndSelectBucket(page, bucket);

  for (const [row, title] of [
    ["trash", "trash"],
    ["archive", "archived buckets"],
    ["join a bucket", "join a bucket"],
  ] as const) {
    await openDrawer(page, bucket);
    await placeRow(page, row).click();
    await expect(drawer(page)).toBeHidden();
    const sheet = page.getByRole("dialog", { name: title });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  }

  await openDrawer(page, bucket);
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();
});
