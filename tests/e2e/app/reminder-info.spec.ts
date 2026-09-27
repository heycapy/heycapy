import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
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

function reminderDialog(page: Page, title: string) {
  return modal(page, new RegExp(`^reminder \\[${title}\\]$`));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Reminder Info"));
});

test("an upcoming reminder is an icon that opens its details", async ({ page }) => {
  const title = uniqueName("renew passport");
  await addDatedItem(page, title);
  await expect(itemRow(page, title)).not.toContainText("reminder");

  await page.getByRole("button", { name: /^reminder / }).click();
  const dialog = reminderDialog(page, title);
  const details = dialog.getByRole("region", { name: "reminders" });
  await expect(details).toContainText(/next \w{3} \d+/);
  await expect(details).toContainText("goes to email (telegram not selected · ntfy not selected)");

  await dialog.getByRole("button", { name: "[ x ]", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("a bucket without a working channel shows a no-reminder icon", async ({ page }) => {
  const settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await option(field(settings, "channels"), "email").click();
  await saveSettings(settings);

  const title = uniqueName("renew passport");
  await addDatedItem(page, title);

  await page.getByRole("button", { name: "no reminder", exact: true }).click();
  await expect(reminderDialog(page, title)).toContainText(
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

  await page.getByRole("button", { name: "reminder history", exact: true }).click();
  const details = reminderDialog(page, title).getByRole("region", { name: "reminders" });
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
