import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal } from "../helpers/settings";
import { enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("timezone"), timezoneId: "America/New_York" });

test("updating an item without changes keeps its date and time", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Zones"));
  const webhook = await enableWebhook(page);
  const title = uniqueName("timed");
  const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const deadline = new Date(`${day}T21:00:00-04:00`).toISOString();
  expect((await postItem(page.request, webhook, { title, deadline })).status()).toBe(201);
  await page.reload();

  const row = itemRow(page, title);
  await expect(row).toContainText("9pm");
  const before = await row.innerText();
  await row.click();
  const dialog = modal(page, /^edit item$/);
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.reload();
  await expect.poll(() => itemRow(page, title).innerText()).toBe(before);
});
