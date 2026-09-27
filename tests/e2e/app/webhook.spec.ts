import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { closeDialog, openFromSettings } from "../helpers/settings";
import { daysFromNow, enableWebhook, postItem, type Webhook } from "../helpers/webhook";

test.use({ storageState: authState("webhook") });
test.describe.configure({ mode: "default" });

let webhook: Webhook;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Webhook Test"));
  webhook = await enableWebhook(page);
});

test("panel shows the endpoint for this bucket and masks the key", async ({ page }) => {
  const { settings, dialog } = await openFromSettings(
    page,
    "advanced",
    "[ configure webhook ]",
    /^webhook \[/
  );
  await expect(dialog.getByText(webhook.url, { exact: true })).toBeVisible();
  // Masked everywhere, including the curl example
  await expect(dialog.getByText(/^hc_live_•+$/)).toBeVisible();
  await expect(dialog.getByText(webhook.key)).toHaveCount(0);

  await dialog.getByRole("button", { name: "show key" }).click();
  await expect(dialog.getByText(webhook.key, { exact: true })).toBeVisible();
  await expect(dialog.locator("pre")).toContainText(webhook.key);

  await dialog.getByRole("button", { name: "hide key" }).click();
  await expect(dialog.getByText(webhook.key)).toHaveCount(0);

  await closeDialog(dialog);
  await closeDialog(settings);
});

test("posted item appears in the bucket live, without a reload", async ({ page, request }) => {
  const title = uniqueName("from webhook");
  const res = await postItem(request, webhook, { title });
  expect(res.status()).toBe(201);
  expect(await res.json()).toMatchObject({ title });
  await expect(itemRow(page, title)).toBeVisible();
});

test("status and deadline from the payload are applied", async ({ page, request }) => {
  const done = uniqueName("already done");
  const res = await postItem(request, webhook, {
    title: done,
    status: "completed",
    deadline: daysFromNow(2),
  });
  expect(res.status()).toBe(201);
  await expect(itemRow(page, done)).toBeVisible();
  await expect(page.getByRole("button", { name: "status: completed" })).toBeVisible();
});

test("rejects a missing or wrong key", async ({ request }) => {
  const noAuth = await request.post(webhook.url, { data: { title: "x" } });
  expect(noAuth.status()).toBe(401);

  const wrong = await postItem(request, webhook, { title: "x" }, "hc_live_" + "0".repeat(32));
  expect(wrong.status()).toBe(401);
});

test("rotating the key invalidates the old one", async ({ page, request }) => {
  const rotated = await enableWebhook(page);
  expect(rotated.key).not.toBe(webhook.key);

  const old = await postItem(request, webhook, { title: "with old key" });
  expect(old.status()).toBe(401);

  const current = await postItem(request, rotated, { title: uniqueName("with new key") });
  expect(current.status()).toBe(201);
});

test("validates the payload", async ({ request }) => {
  const noTitle = await postItem(request, webhook, {});
  expect(noTitle.status()).toBe(400);
  expect(await noTitle.json()).toMatchObject({ error: "title is required" });

  const badDeadline = await postItem(request, webhook, { title: "x", deadline: "tomorrow" });
  expect(badDeadline.status()).toBe(400);

  const tooLong = await postItem(request, webhook, { title: "x".repeat(501) });
  expect(tooLong.status()).toBe(400);
});

test("archived buckets stop accepting webhook items", async ({ page, request }) => {
  const settings = await openFromSettings(page, "advanced", "[ configure webhook ]", /^webhook \[/);
  await closeDialog(settings.dialog);
  await settings.settings.getByRole("button", { name: "[ archive ]", exact: true }).click();
  await expect(settings.settings).not.toBeVisible();

  const res = await postItem(request, webhook, { title: "into the archive" });
  expect(res.status()).toBe(404);
});
