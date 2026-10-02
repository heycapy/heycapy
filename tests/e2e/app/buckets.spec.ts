import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  activeBucketTitle,
  addItem,
  bucketTab,
  createAndSelectBucket,
  createBucket,
  itemRow,
  openNewBucketModal,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("buckets") });
test.describe.configure({ mode: "default" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("buckets", () => {
  test("creates a new bucket", async ({ page }) => {
    const name = uniqueName("E2E Bucket");
    await createBucket(page, name);
    await expect(bucketTab(page, name)).toBeVisible();
  });

  test("newly created bucket is selected automatically", async ({ page }) => {
    const name = uniqueName("Auto Select");
    await createBucket(page, name);
    await expect(activeBucketTitle(page)).toHaveText(name);
  });

  test("rejects duplicate bucket name", async ({ page }) => {
    const name = uniqueName("Dupe");
    await createBucket(page, name);

    await openNewBucketModal(page);
    await page.getByPlaceholder(/bucket name/i).fill(name);
    await page.getByRole("button", { name: "Create bucket", exact: true }).click();
    await expect(page.getByText("A bucket with this name already exists.")).toBeVisible();
    await expect(page.getByPlaceholder(/bucket name/i)).toBeVisible();
  });

  test("duplicate check ignores letter case", async ({ page }) => {
    const name = uniqueName("Case Dupe");
    await createBucket(page, name);

    await openNewBucketModal(page);
    await page.getByPlaceholder(/bucket name/i).fill(name.toUpperCase());
    await page.getByRole("button", { name: "Create bucket", exact: true }).click();
    await expect(page.getByText("A bucket with this name already exists.")).toBeVisible();
  });
});

test.describe("items", () => {
  test.beforeEach(async ({ page }) => {
    await createAndSelectBucket(page, uniqueName("Items Test"));
  });

  test("adds a new item to a bucket", async ({ page }) => {
    const title = uniqueName("buy oat milk");
    await addItem(page, title);
    await expect(page.getByText("no items yet")).not.toBeVisible();
  });

  test("edit dialog opens on item click", async ({ page }) => {
    const title = uniqueName("buy oat milk");
    await addItem(page, title);
    await itemRow(page, title).click();
    await expect(page.getByText("edit item", { exact: true })).toBeVisible();
    await expect(page.locator("textarea")).toHaveValue(title);
  });

  test("edits an existing item title", async ({ page }) => {
    const title = uniqueName("buy oat milk");
    const updated = uniqueName("buy almond milk");
    await addItem(page, title);
    await itemRow(page, title).click();

    await page.locator("textarea").fill(updated);
    await page.getByRole("button", { name: /update/i }).click();
    await expect(itemRow(page, updated)).toBeVisible();
    await expect(itemRow(page, title)).not.toBeVisible();
  });

  test("item add dialog closes on cancel without adding", async ({ page }) => {
    await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
    await expect(page.getByText("new item", { exact: true })).toBeVisible();
    await page.locator("textarea").fill("should not be saved");
    await page.getByRole("button", { name: "[ x ]", exact: true }).click();
    await expect(page.getByText("new item", { exact: true })).not.toBeVisible();
    await expect(page.getByText("no items yet")).toBeVisible();
  });

  test("shows validation error when submitting empty title", async ({ page }) => {
    await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
    await page.getByRole("button", { name: "[ add ]", exact: true }).click();
    await expect(page.getByText(/title is required/i)).toBeVisible();
    await expect(page.getByText("new item", { exact: true })).toBeVisible();
  });
});
