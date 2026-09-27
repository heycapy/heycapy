import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItem, createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import {
  closeDialog,
  expectSelected,
  field,
  openSettings,
  option,
  saveSettings,
  settingsDialog,
  switchTab,
} from "../helpers/settings";
import { daysFromNow, enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("channels") });
test.describe.configure({ mode: "default" });

function notice(page: Page) {
  return page.getByRole("status").filter({ hasText: "this bucket won't send reminders" });
}

async function setEmailChannel(page: Page, on: boolean): Promise<void> {
  const settings = await openSettings(page);
  await switchTab(settings, "notifications");
  const email = option(field(settings, "channels"), "email");
  if ((await email.getAttribute("aria-pressed")) !== String(on)) await email.click();
  await saveSettings(settings);
}

async function addDatedItem(page: Page, title: string): Promise<void> {
  const webhook = await enableWebhook(page);
  const res = await postItem(page.request, webhook, { title, deadline: daysFromNow(2) });
  expect(res.status()).toBe(201);
  await expect(itemRow(page, title)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Channels Test"));
});

test("a new blank bucket starts with the user's working channels", async ({ page }) => {
  const settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await expectSelected(option(field(settings, "channels"), "email"));
  await closeDialog(settings);
});

test("no notice while a working channel is selected", async ({ page }) => {
  await addDatedItem(page, uniqueName("due soon"));
  await expect(notice(page)).toHaveCount(0);
});

test("notice appears when dated items have no working channel, and set up fixes it", async ({
  page,
}) => {
  await addDatedItem(page, uniqueName("due soon"));
  await setEmailChannel(page, false);
  await expect(notice(page)).toBeVisible();

  await notice(page).getByRole("button", { name: "[ set up ]", exact: true }).click();
  const settings = settingsDialog(page);
  await expect(field(settings, "channels")).toBeVisible();
  await option(field(settings, "channels"), "email").click();
  await saveSettings(settings);

  await expect(notice(page)).toHaveCount(0);
});

test("no notice for a bucket without dated items, even with no channels", async ({ page }) => {
  await setEmailChannel(page, false);
  await addItem(page, uniqueName("no date"));
  await expect(notice(page)).toHaveCount(0);
});
