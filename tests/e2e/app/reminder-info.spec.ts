import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  createAndSelectBucket,
  itemRow,
  itemRowContainer,
  openItemMenu,
  openReminderDetails,
  uniqueName,
} from "../helpers/buckets";
import { field, modal, openSettings, option, saveSettings, switchTab } from "../helpers/settings";
import { daysFromNow, enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("reminder-info") });
test.describe.configure({ mode: "default" });

async function addDatedItem(page: Page, title: string): Promise<void> {
  const webhook = await enableWebhook(page);
  const res = await postItem(page.request, webhook, { title, deadline: daysFromNow(2) });
  expect(res.status()).toBe(201);
  await expect(itemRow(page, title)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Reminder Info"));
});

test("an upcoming reminder shows in the item menu, which opens its details", async ({ page }) => {
  const title = uniqueName("renew passport");
  await addDatedItem(page, title);
  await expect(itemRow(page, title)).not.toContainText("reminder");
  await expect(itemRowContainer(page, title).getByRole("button", { name: /reminder/ })).toHaveCount(
    0
  );

  const menu = await openItemMenu(page, title);
  const entry = menu.getByRole("button", { name: /^reminders/ });
  await expect(entry).toContainText(/next \w{3} \d+/);
  await entry.click();
  const details = menu.getByRole("region", { name: "reminders" });
  await expect(details).toContainText(/next \w{3} \d+/);
  await expect(details).toContainText(
    "goes to email (push not selected · telegram not selected · ntfy not selected)"
  );

  await menu.getByRole("button", { name: "[ back ]", exact: true }).click();
  await expect(details).toHaveCount(0);
  await expect(entry).toBeVisible();
});

test("a bucket without a working channel says so in the item menu", async ({ page }) => {
  const settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await option(field(settings, "channels"), "email").click();
  await saveSettings(settings);

  const title = uniqueName("renew passport");
  await addDatedItem(page, title);

  const menu = await openItemMenu(page, title);
  await expect(menu.getByRole("button", { name: /^reminders/ })).toContainText(
    "no working channel"
  );
  await menu.getByRole("button", { name: /^reminders/ }).click();
  await expect(menu.getByRole("region", { name: "reminders" })).toContainText(
    "no reminder — this bucket has no working channel"
  );
});

test("a completed item still shows what happened with its reminders", async ({ page }) => {
  const title = uniqueName("paid bill");
  const webhook = await enableWebhook(page);
  const res = await postItem(page.request, webhook, {
    title,
    status: "completed",
    deadline: daysFromNow(2),
  });
  expect(res.status()).toBe(201);
  await expect(itemRow(page, title)).toBeVisible();

  const details = await openReminderDetails(page, title);
  await expect(details).toContainText("completed");
  await expect(details).not.toContainText("goes to");
  await expect(details).toContainText("nothing sent yet");
});

test("the edit dialog no longer shows reminder details", async ({ page }) => {
  const title = uniqueName("renew passport");
  await addDatedItem(page, title);

  await itemRow(page, title).click();
  const edit = modal(page, /^edit item$/);
  await expect(edit).toBeVisible();
  await expect(edit.getByRole("region", { name: "reminders" })).toHaveCount(0);
});

test("reminder details taller than the screen scroll to their history", async ({ page }) => {
  const title = uniqueName("renew passport");
  await addDatedItem(page, title);
  const details = await openReminderDetails(page, title);
  await page.setViewportSize({ width: 360, height: 170 });
  const history = details.getByText("nothing sent yet");
  await expect(history).toBeAttached();
  await details.hover();
  await page.mouse.wheel(0, 1000);
  await expect(history).toBeInViewport({ ratio: 1 });
});
