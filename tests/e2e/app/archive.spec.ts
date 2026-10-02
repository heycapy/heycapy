import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  bucketTab,
  createAndSelectBucket,
  createBucket,
  itemRow,
  selectBucket,
  uniqueName,
} from "../helpers/buckets";
import { openSettings, option, switchTab } from "../helpers/settings";

test.use({ storageState: authState("archive") });
test.describe.configure({ mode: "default" });

async function archiveActiveBucket(page: Page): Promise<void> {
  const settings = await openSettings(page);
  await switchTab(settings, "advanced");
  await option(settings, "[ archive ]").click();
  await expect(settings).not.toBeVisible();
}

async function deleteActiveBucket(page: Page): Promise<void> {
  const settings = await openSettings(page);
  await switchTab(settings, "advanced");
  await option(settings, "[ delete ]").click();
  await option(settings, "[ confirm ]").click();
  await expect(settings).not.toBeVisible();
}

async function openSheet(page: Page, menuItem: "archived" | "trash"): Promise<Locator> {
  await page.getByRole("button", { name: "[ ··· ]", exact: true }).click();
  await page.getByRole("button", { name: menuItem, exact: true }).click();
  const header = menuItem === "archived" ? "archived buckets" : "trash";
  const sheet = page.locator("aside").filter({ has: page.getByText(header, { exact: true }) });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("loading...")).not.toBeVisible();
  return sheet;
}

function sheetRow(sheet: Locator, name: string): Locator {
  return sheet
    .locator("div.flex.items-center")
    .filter({ has: sheet.page().getByText(name, { exact: true }) });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("archived buckets", () => {
  test("archived bucket is listed and restoring brings it back with its items", async ({
    page,
  }) => {
    const name = uniqueName("Archive Me");
    const item = uniqueName("survives archive");
    await createAndSelectBucket(page, name);
    await addItem(page, item);
    await archiveActiveBucket(page);
    await expect(bucketTab(page, name)).not.toBeVisible();

    const sheet = await openSheet(page, "archived");
    const row = sheetRow(sheet, name);
    await expect(row).toBeVisible();
    await expect(row.getByText(/^archived /)).toBeVisible();

    await option(row, "[ restore ]").click();
    await expect(row).not.toBeVisible();

    await page.reload();
    await expect(bucketTab(page, name)).toBeVisible();
    await selectBucket(page, name);
    await expect(itemRow(page, item)).toBeVisible();
  });

  test("deleting from the archive moves the bucket to trash", async ({ page }) => {
    const name = uniqueName("Archive Then Delete");
    await createAndSelectBucket(page, name);
    await archiveActiveBucket(page);

    const archived = await openSheet(page, "archived");
    const row = sheetRow(archived, name);
    await option(row, "[ delete ]").click();
    await option(row, "[ confirm ]").click();
    await expect(row).not.toBeVisible();
    await option(archived, "[ x ]").click();

    const trash = await openSheet(page, "trash");
    await expect(sheetRow(trash, name)).toBeVisible();
  });

  test("an archived name still counts as taken", async ({ page }) => {
    const name = uniqueName("Archived Name");
    await createAndSelectBucket(page, name);
    await archiveActiveBucket(page);

    await page
      .getByRole("button", { name: /new bucket|add bucket/i })
      .first()
      .click();
    await page.getByRole("button", { name: /^Blank/ }).click();
    await page.getByPlaceholder(/bucket name/i).fill(name);
    await page.getByRole("button", { name: "Create bucket", exact: true }).click();
    await expect(page.getByText("A bucket with this name already exists.")).toBeVisible();
  });
});

test.describe("trash", () => {
  test("deleted bucket is listed and can be restored", async ({ page }) => {
    const name = uniqueName("Trash Me");
    await createAndSelectBucket(page, name);
    await deleteActiveBucket(page);

    const sheet = await openSheet(page, "trash");
    const row = sheetRow(sheet, name);
    await expect(row.getByText(/^0 items · deleted /)).toBeVisible();
    await option(row, "[ restore ]").click();
    await expect(row).not.toBeVisible();

    await page.reload();
    await expect(bucketTab(page, name)).toBeVisible();
  });

  test("restoring is refused when a live bucket already has the name", async ({ page }) => {
    const name = uniqueName("Name Clash");
    await createAndSelectBucket(page, name);
    await deleteActiveBucket(page);
    await createBucket(page, name.toUpperCase());

    const sheet = await openSheet(page, "trash");
    const row = sheetRow(sheet, name);
    await option(row, "[ restore ]").click();
    await expect(
      sheet.getByText(
        `A bucket named "${name}" already exists. Rename it before restoring this one.`
      )
    ).toBeVisible();
    await expect(row).toBeVisible();
  });

  test("permanent delete asks for confirmation and removes the bucket for good", async ({
    page,
  }) => {
    const name = uniqueName("Gone Forever");
    await createAndSelectBucket(page, name);
    await deleteActiveBucket(page);

    let sheet = await openSheet(page, "trash");
    const row = sheetRow(sheet, name);
    await option(row, "[ delete ]").click();
    await option(row, "[ cancel ]").click();
    await expect(option(row, "[ restore ]")).toBeVisible();

    await option(row, "[ delete ]").click();
    await option(row, "[ confirm ]").click();
    await expect(row).not.toBeVisible();

    await page.reload();
    sheet = await openSheet(page, "trash");
    await expect(sheetRow(sheet, name)).not.toBeVisible();
    await expect(bucketTab(page, name)).not.toBeVisible();
  });

  test("a deleted name can be reused", async ({ page }) => {
    const name = uniqueName("Reusable");
    await createAndSelectBucket(page, name);
    await deleteActiveBucket(page);
    await createBucket(page, name);
    await expect(bucketTab(page, name)).toBeVisible();
  });
});
