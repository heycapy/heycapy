import { expect, type Page } from "@playwright/test";

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

export async function openNewBucketModal(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /new bucket|add bucket/i })
    .first()
    .click();
  await page.getByRole("button", { name: /^Blank/ }).click();
  await expect(page.getByPlaceholder(/bucket name/i)).toBeVisible();
}

export async function createBucket(page: Page, name: string): Promise<void> {
  await openNewBucketModal(page);
  await page.getByPlaceholder(/bucket name/i).fill(name);
  await page.getByRole("button", { name: "Create bucket", exact: true }).click();
  await expect(page.getByPlaceholder(/bucket name/i)).not.toBeVisible();
  await expect(bucketTab(page, name)).toBeVisible();
}

export async function selectBucket(page: Page, name: string): Promise<void> {
  await bucketTab(page, name).click();
  await expect(activeBucketTitle(page)).toHaveText(name);
  await expect(page.locator("main h2")).toHaveText(name);
}

export async function createAndSelectBucket(page: Page, name: string): Promise<void> {
  await createBucket(page, name);
  await selectBucket(page, name);
}

export function bucketTab(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

export function activeBucketTitle(page: Page) {
  return page.locator('nav[aria-label="buckets"] [aria-current="page"]');
}

export async function addItem(
  page: Page,
  title: string,
  opts: { status?: string } = {}
): Promise<void> {
  await page.getByRole("button", { name: "add with details", exact: true }).click();
  const dialog = newItemForm(page);
  await expect(dialog).toBeVisible();
  await dialog.locator("textarea").fill(title);
  if (opts.status) {
    await dialog.getByRole("button", { name: opts.status, exact: true }).click();
  }
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(itemRow(page, title)).toBeVisible();
}

// a page on a phone, the panel grown out of the add box on a wider screen
export function newItemForm(page: Page) {
  return page.getByRole("dialog", { name: "new item", exact: true });
}

export function itemForm(page: Page) {
  return page.getByRole("dialog", { name: /^(new|edit) item$/ });
}

export function itemRow(page: Page, title: string) {
  return page.getByRole("button", { name: title });
}

export async function openBucketOnPhone(page: Page, name: string): Promise<void> {
  await page.goto("/");
  await createAndSelectBucket(page, name);
  await page.setViewportSize({ width: 390, height: 844 });
}

export function addItemButton(page: Page) {
  return page.getByRole("button", { name: "add with details", exact: true });
}

export function addBox(page: Page) {
  return page.getByRole("textbox", { name: /^add to / });
}

export function itemMenu(page: Page, title: string) {
  return page.getByRole("dialog", { name: title });
}

export function itemRowContainer(page: Page, title: string) {
  return itemRow(page, title).locator("xpath=..");
}

export function itemTick(page: Page, title: string) {
  return page.getByRole("checkbox", { name: title, exact: true });
}

export async function openItemMenu(page: Page, title: string) {
  await itemRowContainer(page, title).getByRole("button", { name: "item menu" }).click();
  await expect(itemMenu(page, title)).toBeVisible();
  return itemMenu(page, title);
}

// The reminder details live one tap into the item's menu
export async function openReminderDetails(page: Page, title: string) {
  const menu = await openItemMenu(page, title);
  await menu.getByRole("button", { name: /^reminders/ }).click();
  return menu.getByRole("region", { name: "reminders" });
}
