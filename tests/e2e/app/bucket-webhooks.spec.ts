import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, selectBucket, uniqueName } from "../helpers/buckets";
import {
  closeDialog,
  expectSelected,
  field,
  openSettings,
  option,
  saveSettings,
  switchTab,
} from "../helpers/settings";

test.use({ storageState: authState("bucket-webhooks") });

async function addWebhookInTweaks(page: Page, name: string, url: string) {
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  const box = page
    .locator("div")
    .filter({ has: page.getByText("other apps", { exact: true }) })
    .last();
  await box.getByRole("button", { name: "[ add app + ]" }).click();
  await box.getByPlaceholder("work slack").fill(name);
  await box.getByPlaceholder("https://example.com/hooks/heycapy").fill(url);
  await box.getByRole("button", { name: "[ save ]" }).click();
  await expect(box.getByRole("button", { name: "[send test]" })).toBeVisible();
}

test("webhooks set up in tweaks are picked per bucket, and new buckets get the default ones", async ({
  page,
}) => {
  const older = uniqueName("Work");
  await page.goto("/");
  await createAndSelectBucket(page, older);

  let settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await expect(field(settings, "channels")).toContainText(
    "add discord, slack or your own server in tweaks"
  );
  await closeDialog(settings);

  await addWebhookInTweaks(page, "team chat", "https://discord.com/api/webhooks/1/abc");
  await page.goto("/");
  await selectBucket(page, older);

  settings = await openSettings(page);
  await switchTab(settings, "notifications");
  const teamChat = option(field(settings, "channels"), "team chat");
  await expectSelected(teamChat, false);
  await teamChat.click();
  await saveSettings(settings);

  settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await expectSelected(option(field(settings, "channels"), "team chat"));
  await closeDialog(settings);

  await createAndSelectBucket(page, uniqueName("Fresh"));
  settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await expectSelected(option(field(settings, "channels"), "team chat"));
  await closeDialog(settings);
});
