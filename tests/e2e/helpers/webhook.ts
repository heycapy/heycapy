import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { closeDialog, openFromSettings, settingsDialog } from "./settings";

export type Webhook = { url: string; key: string };

export async function enableWebhook(page: Page): Promise<Webhook> {
  const { settings, dialog } = await openFromSettings(
    page,
    "advanced",
    "[ configure webhook ]",
    /^webhook \[/
  );
  await dialog.getByRole("button", { name: /rotate key/ }).click();
  const keyEl = dialog.locator("code").filter({ hasText: /^hc_live_[A-Za-z0-9_-]+$/ });
  await expect(keyEl).toBeVisible();
  const key = (await keyEl.textContent()) ?? "";
  const url =
    (await dialog
      .locator("code")
      .filter({ hasText: /\/api\/webhook\/\d+$/ })
      .textContent()) ?? "";

  await closeDialog(dialog);
  await closeDialog(settings);
  await expect(settingsDialog(page)).not.toBeVisible();
  return { url, key };
}

export async function postItem(
  request: APIRequestContext,
  webhook: Webhook,
  body: Record<string, unknown>,
  key = webhook.key
) {
  return request.post(webhook.url, {
    headers: { Authorization: `Bearer ${key}` },
    data: body,
  });
}

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
