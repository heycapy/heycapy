import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { activeBucketTitle, createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal } from "../helpers/settings";
import { daysFromNow, enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("today") });
test.describe.configure({ mode: "default" });

function todayButton(page: Page) {
  return page.getByRole("button", { name: "today", exact: true });
}

async function bucketWithItems(page: Page, prefix: string, entries: [string, string?][]) {
  const name = uniqueName(prefix);
  await createAndSelectBucket(page, name);
  const webhook = await enableWebhook(page);
  for (const [title, deadline] of entries) {
    expect((await postItem(page.request, webhook, { title, deadline })).status()).toBe(201);
  }
  return name;
}

test("a new session opens on today, and choosing a bucket leaves it", async ({ page, browser }) => {
  await page.goto("/");
  const name = await bucketWithItems(page, "Bills", []);
  await expect(todayButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(activeBucketTitle(page)).toHaveText(name);

  const fresh = await browser.newContext({ storageState: authState("today") });
  const next = await fresh.newPage();
  await next.goto("/");
  await expect(todayButton(next)).toHaveAttribute("aria-pressed", "true");
  await expect(next.getByRole("textbox", { name: "search all items" })).toBeVisible();
  await fresh.close();

  await todayButton(page).click();
  await expect(page.getByRole("textbox", { name: "search all items" })).toBeVisible();
});

test("shows what's due from every bucket, grouped by when", async ({ page }) => {
  await page.goto("/");
  const late = uniqueName("pay rent");
  const soon = uniqueName("renew passport");
  const later = uniqueName("water bill");
  const bills = await bucketWithItems(page, "Bills", [
    [late, daysFromNow(-1)],
    [later, daysFromNow(3)],
    [uniqueName("someday"), undefined],
  ]);
  await bucketWithItems(page, "Admin", [[soon, daysFromNow(1)]]);
  await todayButton(page).click();

  await expect(page.getByRole("region", { name: "overdue" })).toContainText(late);
  await expect(page.getByRole("region", { name: "tomorrow" })).toContainText(soon);
  await expect(itemRow(page, later)).toBeVisible();
  await expect(itemRow(page, late)).toContainText(bills);
  await expect(page.getByText("someday")).toHaveCount(0);
});

test("search finds items in any bucket, and clearing it brings today back", async ({ page }) => {
  await page.goto("/");
  const tag = uniqueName("zebra");
  await bucketWithItems(page, "Notes", [[`${tag} one`], [`${tag} two`, daysFromNow(20)]]);
  await todayButton(page).click();

  const search = page.getByRole("textbox", { name: "search all items" });
  await search.fill(tag);
  await expect(page.getByRole("region", { name: "2 found" })).toBeVisible();
  await expect(itemRow(page, `${tag} one`)).toContainText("no date");
  await expect(itemRow(page, `${tag} two`)).not.toContainText("no date");

  await page.getByRole("button", { name: "clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(itemRow(page, `${tag} one`)).toHaveCount(0);
});

test("items can be edited from today", async ({ page }) => {
  await page.goto("/");
  const title = uniqueName("call mom");
  await bucketWithItems(page, "Family", [[title, daysFromNow(1)]]);
  await todayButton(page).click();

  await itemRow(page, title).click();
  const dialog = modal(page, /^edit item$/);
  await dialog.locator("textarea").first().fill(`${title} back`);
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(itemRow(page, `${title} back`)).toBeVisible();
});
