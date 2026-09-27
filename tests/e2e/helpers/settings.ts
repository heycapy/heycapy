import { expect, type Locator, type Page } from "@playwright/test";

export function modal(page: Page, header: RegExp): Locator {
  return page.locator("div.fixed").filter({ has: page.getByText(header) });
}

export function settingsDialog(page: Page): Locator {
  return modal(page, /^bucket settings \[/);
}

export async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "[ settings ]", exact: true }).click();
  const dialog = settingsDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function saveSettings(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "[ save ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

export async function closeDialog(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "[ x ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

export async function switchTab(dialog: Locator, tab: "items" | "notifications" | "advanced") {
  await dialog.getByRole("button", { name: tab, exact: true }).click();
}

// Label + hint + control wrapper
export function field(dialog: Locator, label: string): Locator {
  return dialog
    .locator("label")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..");
}

export function optionGroup(scope: Locator, name: string): Locator {
  return scope.getByRole("group", { name, exact: true });
}

export function option(scope: Locator, name: string): Locator {
  return scope.getByRole("button", { name, exact: true });
}

export async function expectSelected(button: Locator, selected = true): Promise<void> {
  await expect(button).toHaveAttribute("aria-pressed", String(selected));
}

export function nameInput(dialog: Locator): Locator {
  return dialog.getByLabel("name", { exact: true });
}

export async function openFromSettings(
  page: Page,
  tab: "notifications" | "advanced",
  button: string,
  header: RegExp
): Promise<{ settings: Locator; dialog: Locator }> {
  const settings = await openSettings(page);
  await switchTab(settings, tab);
  await option(settings, button).click();
  const dialog = modal(page, header);
  await expect(dialog).toBeVisible();
  return { settings, dialog };
}
