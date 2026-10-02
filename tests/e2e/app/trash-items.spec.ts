import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItem, createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal, option } from "../helpers/settings";

test.use({ storageState: authState("trash-items") });
test.describe.configure({ mode: "default" });

let bucket: string;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  bucket = uniqueName("Trash Items");
  await createAndSelectBucket(page, bucket);
});

async function deleteItem(page: Page, title: string): Promise<void> {
  await itemRow(page, title).click();
  const dialog = modal(page, /^edit item$/);
  await dialog.getByRole("button", { name: "delete item" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(itemRow(page, title)).toHaveCount(0);
}

async function openTrash(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "[ ··· ]", exact: true }).click();
  await page.getByRole("button", { name: "trash", exact: true }).click();
  const sheet = page.locator("aside").filter({ has: page.getByText("trash", { exact: true }) });
  await expect(sheet.getByText("loading...")).not.toBeVisible();
  return sheet;
}

function trashedItem(sheet: Locator, title: string): Locator {
  return sheet
    .getByRole("region", { name: "items" })
    .locator("div.flex.items-center")
    .filter({ has: sheet.page().getByText(title, { exact: true }) });
}

test("a deleted item can be brought straight back with undo", async ({ page }) => {
  const title = uniqueName("pay rent");
  await addItem(page, title);
  await deleteItem(page, title);

  const toast = page.getByText(`deleted "${title}"`);
  await expect(toast).toBeVisible();
  await page.getByRole("button", { name: "[ undo ]", exact: true }).click();
  await expect(itemRow(page, title)).toBeVisible();
});

test("deleted items wait in the trash and can be restored", async ({ page }) => {
  const title = uniqueName("call dentist");
  await addItem(page, title);
  await deleteItem(page, title);

  const sheet = await openTrash(page);
  await expect(sheet.getByText("deleted forever after 30 days in the trash")).toBeVisible();
  const row = trashedItem(sheet, title);
  await expect(row).toContainText(`${bucket} · deleted`);
  await option(row, "[ restore ]").click();
  await expect(row).toHaveCount(0);

  await page.keyboard.press("Escape");
  await page.goto("/");
  await expect(itemRow(page, title)).toBeVisible();
});

test("deleting forever and emptying the trash both ask first", async ({ page }) => {
  const first = uniqueName("old note");
  const second = uniqueName("older note");
  await addItem(page, first);
  await addItem(page, second);
  await deleteItem(page, first);
  await deleteItem(page, second);

  const sheet = await openTrash(page);
  const row = trashedItem(sheet, first);
  await option(row, "[ delete ]").click();
  await option(row, "[ confirm ]").click();
  await expect(row).toHaveCount(0);

  await option(sheet, "[ empty trash ]").click();
  await option(sheet, "[ confirm ]").click();
  await expect(sheet.getByText("trash is empty")).toBeVisible();
});
