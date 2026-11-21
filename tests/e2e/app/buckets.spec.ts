import { test, expect } from "@playwright/test";
import { ITEM_GONE_ERROR } from "@/constants";
import { authState } from "../helpers/auth";
import {
  deleteFromMenu,
  openEditForm,
  activeBucketTitle,
  addItem,
  bucketTab,
  createAndSelectBucket,
  createBucket,
  itemRow,
  newItemForm,
  openNewBucketModal,
  selectBucket,
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
    await page.getByRole("button", { name: "[ create bucket ]", exact: true }).click();
    await expect(page.getByText("A bucket with this name already exists.")).toBeVisible();
    await expect(page.getByPlaceholder(/bucket name/i)).toBeVisible();
  });

  test("duplicate check ignores letter case", async ({ page }) => {
    const name = uniqueName("Case Dupe");
    await createBucket(page, name);

    await openNewBucketModal(page);
    await page.getByPlaceholder(/bucket name/i).fill(name.toUpperCase());
    await page.getByRole("button", { name: "[ create bucket ]", exact: true }).click();
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

  test("an item opens in place on click", async ({ page }) => {
    const title = uniqueName("buy oat milk");
    await addItem(page, title);
    await openEditForm(page, title);
    await expect(page.getByRole("textbox", { name: "title" })).toHaveValue(title);
    await expect(page.getByRole("dialog", { name: "edit item" })).toHaveCount(0);
  });

  test("edits an existing item title", async ({ page }) => {
    const title = uniqueName("buy oat milk");
    const updated = uniqueName("buy almond milk");
    await addItem(page, title);
    await itemRow(page, title).click();

    await page.getByRole("textbox", { name: "title" }).fill(updated);
    await page.keyboard.press("Enter");
    await expect(itemRow(page, updated)).toBeVisible();
    await expect(itemRow(page, title)).not.toBeVisible();
  });

  test("says so when an item is gone before the edit is saved", async ({ page, context }) => {
    const bucket = uniqueName("Gone");
    const title = uniqueName("buy oat milk");
    await createAndSelectBucket(page, bucket);
    await addItem(page, title);
    await itemRow(page, title).click();
    await page.getByRole("textbox", { name: "title" }).fill(uniqueName("buy almond milk"));

    const other = await context.newPage();
    await other.goto("/");
    await selectBucket(other, bucket);
    await deleteFromMenu(other, title);
    await expect(itemRow(other, title)).not.toBeVisible();
    await other.close();

    await page.keyboard.press("Enter");
    await expect(page.getByText(ITEM_GONE_ERROR)).toBeVisible();
  });

  test("says so when an item is gone before it is deleted", async ({ page, browser }) => {
    const bucket = uniqueName("Gone");
    const title = uniqueName("buy oat milk");
    await createAndSelectBucket(page, bucket);
    await addItem(page, title);
    // This tab stops hearing from the server, so its list still shows the item
    await page.route(/\/api\/(events|v1\/sync\/)/, (route) => route.abort());

    const elsewhere = await browser.newContext({ storageState: authState("buckets") });
    const other = await elsewhere.newPage();
    await other.goto("/");
    await selectBucket(other, bucket);
    await deleteFromMenu(other, title);
    await expect(itemRow(other, title)).not.toBeVisible();
    await elsewhere.close();

    await deleteFromMenu(page, title);
    await expect(page.getByText(ITEM_GONE_ERROR)).toBeVisible();
    await expect(page.getByRole("button", { name: /undo/i })).not.toBeVisible();
  });

  test("item add form closes on cancel without adding", async ({ page }) => {
    await page.getByRole("button", { name: "add item", exact: true }).click();
    await expect(newItemForm(page)).toBeVisible();
    await newItemForm(page).locator("textarea").first().fill("should not be saved");
    await page.keyboard.press("Escape");
    await expect(newItemForm(page)).not.toBeVisible();
    await expect(page.getByText("no items yet")).toBeVisible();
  });

  test("the add arrow stays off until there is a title", async ({ page }) => {
    await page.getByRole("button", { name: "add item", exact: true }).click();
    const form = newItemForm(page);
    const add = form.getByRole("button", { name: "add", exact: true });
    await expect(add).toBeDisabled();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(form).toBeVisible();

    await form.locator("textarea").first().fill("a title");
    await expect(add).toBeEnabled();
  });
});
