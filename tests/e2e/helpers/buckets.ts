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
}

export async function createAndSelectBucket(page: Page, name: string): Promise<void> {
  await createBucket(page, name);
  await selectBucket(page, name);
}

export function bucketTab(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

export function activeBucketTitle(page: Page) {
  return page.locator("main span.font-pixel.text-sm").first();
}

export async function addItem(
  page: Page,
  title: string,
  opts: { status?: string } = {}
): Promise<void> {
  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = page
    .locator("div.fixed")
    .filter({ has: page.getByText("new item", { exact: true }) });
  await expect(dialog).toBeVisible();
  await dialog.locator("textarea").fill(title);
  if (opts.status) {
    await dialog.getByRole("button", { name: opts.status, exact: true }).click();
  }
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(itemRow(page, title)).toBeVisible();
}

export function itemRow(page: Page, title: string) {
  return page.getByRole("button", { name: title });
}
