import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  activeBucketTitle,
  createAndSelectBucket,
  editForm,
  itemRow,
  uniqueName,
} from "../helpers/buckets";
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
  await expect(todayButton(page)).not.toHaveAttribute("aria-current");
  await expect(activeBucketTitle(page)).toHaveText(name);

  const fresh = await browser.newContext({ storageState: authState("today") });
  const next = await fresh.newPage();
  await next.goto("/");
  await expect(todayButton(next)).toHaveAttribute("aria-current", "page");
  await expect(next.getByRole("heading", { name: "today" })).toBeVisible();
  await fresh.close();

  await todayButton(page).click();
  await expect(page.getByRole("heading", { name: "today" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "search all items" })).toHaveCount(0);
});

function todayDate(): string {
  return new Date().toLocaleDateString("en-CA");
}

test("shows only what's overdue or due today, from every bucket", async ({ page }) => {
  await page.goto("/");
  const late = uniqueName("pay rent");
  const due = uniqueName("renew passport");
  const tomorrow = uniqueName("water bill");
  const bills = await bucketWithItems(page, "Bills", [
    [late, daysFromNow(-1)],
    [tomorrow, daysFromNow(1)],
    [uniqueName("someday"), undefined],
  ]);
  await bucketWithItems(page, "Admin", [[due, todayDate()]]);
  await todayButton(page).click();

  await expect(page.getByRole("region", { name: "overdue" })).toContainText(late);
  await expect(page.getByRole("region", { name: "today" })).toContainText(due);
  await expect(itemRow(page, late)).toContainText(bills);
  await expect(itemRow(page, tomorrow)).toHaveCount(0);
  await expect(page.getByText("someday")).toHaveCount(0);
});

test("search next to add finds items in any bucket, dated or not", async ({ page }) => {
  await page.goto("/");
  const tag = uniqueName("zebra");
  await bucketWithItems(page, "Notes", [[`${tag} one`], [`${tag} two`, daysFromNow(20)]]);

  await page.getByRole("button", { name: "search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "search" });
  const box = search.getByRole("textbox", { name: "search all items" });
  await expect(box).toBeFocused();
  await box.fill(tag);
  await expect(search.getByRole("region", { name: "2 found" })).toBeVisible();
  await expect(search.getByRole("button", { name: `${tag} one` })).toContainText("no date");
  await expect(search.getByRole("button", { name: `${tag} two` })).not.toContainText("no date");

  await box.fill(`${tag} nothing like this`);
  await expect(search.getByText("no items match")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);
});

test("items can be edited from today", async ({ page }) => {
  await page.goto("/");
  const title = uniqueName("call mom");
  await bucketWithItems(page, "Family", [[title, todayDate()]]);
  await todayButton(page).click();

  await itemRow(page, title).click();
  const dialog = editForm(page);
  await expect(dialog).toHaveAttribute("data-item-panel");
  await dialog.locator("textarea").first().fill(`${title} back`);
  await dialog.getByRole("button", { name: "update", exact: true }).click();
  await expect(itemRow(page, `${title} back`)).toBeVisible();
});

test("today adds to the bucket picked beside the add box", async ({ page }) => {
  await page.goto("/");
  await bucketWithItems(page, "Home", []);
  const work = await bucketWithItems(page, "Work", []);
  await todayButton(page).click();
  await expect(page.getByRole("heading", { name: "today", level: 2 })).toBeAttached();

  await page.getByRole("button", { name: /change bucket$/ }).click();
  await page
    .getByRole("group", { name: "add to bucket" })
    .getByRole("button", { name: work })
    .click();
  const box = page.getByRole("textbox", { name: `add to ${work}` });
  await expect(box).toBeFocused();
  await box.fill("water the plants today");
  await box.press("Enter");
  await expect(itemRow(page, "water the plants")).toBeVisible();

  await page.getByRole("button", { name: work, exact: true }).click();
  await expect(activeBucketTitle(page)).toHaveText(work);
  await expect(itemRow(page, "water the plants")).toBeVisible();
});
