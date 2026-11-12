import { expect, type Locator, type Page } from "@playwright/test";

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
  await page.getByRole("button", { name: "[ create bucket ]", exact: true }).click();
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

export async function addItem(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "add with details", exact: true }).click();
  const dialog = newItemForm(page);
  await expect(dialog).toBeVisible();
  await dialog.locator("textarea").fill(title);
  await dialog.getByRole("button", { name: "add", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(itemRow(page, title)).toBeVisible();
}

export function newItemForm(page: Page) {
  return page.getByRole("dialog", { name: "new item", exact: true });
}

export function editForm(page: Page) {
  return page.getByRole("dialog", { name: "edit item", exact: true });
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

export async function untilStill(page: Page, target: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const at = (await target.boundingBox())?.y;
      await page.waitForTimeout(100);
      return at !== undefined && at === (await target.boundingBox())?.y;
    })
    .toBe(true);
}

export function detailChip(form: Locator, name: string) {
  return form
    .getByRole("group", { name: "item details" })
    .getByRole("button", { name: new RegExp(`^${name}(:|$)`) });
}

export async function openDetail(form: Locator, name: string): Promise<void> {
  const chip = detailChip(form, name);
  if ((await chip.getAttribute("aria-expanded")) !== "true") await chip.click();
  await expect(chip).toHaveAttribute("aria-expanded", "true");
}

// The assignee field is a multi-select: switches people on or off until only `only` is on, or everyone
// is when it's null
export async function assignOnly(form: Locator, only: string | RegExp | null): Promise<void> {
  await openDetail(form, "assignee");
  const field = form.getByText("assigned to", { exact: true }).locator("..");
  const buttons = field.getByRole("button");
  const wanted = only === null ? null : field.getByRole("button", { name: only });
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    const shouldBeOn = wanted === null || (await button.and(wanted).count()) > 0;
    const isOn = (await button.getAttribute("aria-pressed")) === "true";
    if (isOn !== shouldBeOn) await button.click();
  }
}
