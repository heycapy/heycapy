import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addBox,
  addItemButton,
  createAndSelectBucket,
  itemRow,
  selectBucket,
  uniqueName,
} from "../helpers/buckets";
import { modal } from "../helpers/settings";

test.use({ storageState: authState("drafts") });

// Wednesday Oct 7 2026, 8am
const WEDNESDAY = new Date(2026, 9, 7, 8, 0);

function clearButton(page: Page) {
  return page.getByRole("button", { name: "clear", exact: true });
}

test("closing the full form keeps what was typed, edits there included, and [×] clears it", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Cat"));
  await expect(clearButton(page)).toHaveCount(0);

  await addBox(page).fill("buy cat food");
  await addItemButton(page).click();
  const dialog = modal(page, /^new item$/);
  const title = dialog.locator("textarea").first();
  await expect(title).toHaveValue("buy cat food");
  await title.fill("buy cat food and litter");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(addBox(page)).toHaveValue("buy cat food and litter");
  await clearButton(page).click();
  await expect(addBox(page)).toHaveValue("");
  await expect(addBox(page)).toBeFocused();
  await expect(clearButton(page)).toHaveCount(0);
});

test("escape in the add box clears it", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Esc"));
  await addBox(page).fill("cat needs some space");
  await addBox(page).press("Escape");
  await expect(addBox(page)).toHaveValue("");
});

test("a date picked in the form stays with the draft and wins over typed words", async ({
  page,
}) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Vet"));
  const title = uniqueName("vet visit");
  await addBox(page).fill(title);
  await addItemButton(page).click();
  const dialog = modal(page, /^new item$/);
  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: "20", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Oct 20", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "[ x ]", exact: true }).click();
  await expect(dialog).toBeHidden();

  const hint = page.getByTestId("quick-add-hint");
  await expect(hint).toContainText("Oct 20");
  await addBox(page).fill(`${title} tomorrow`);
  await expect(hint).toContainText("Oct 20");

  await addItemButton(page).click();
  await expect(dialog.getByRole("button", { name: "Oct 20", exact: true })).toBeVisible();
  await expect(dialog.getByTestId("title-date-highlight")).toHaveCount(0);
  await dialog.getByRole("button", { name: "[ x ]", exact: true }).click();

  await addBox(page).press("Enter");
  await expect(itemRow(page, `${title} tomorrow`)).toContainText("Oct 20");
  await expect(addBox(page)).toHaveValue("");
  await expect(hint).toHaveCount(0);
});

test("each bucket keeps its own draft, through a reload", async ({ page }) => {
  await page.goto("/");
  const first = uniqueName("Treats");
  const second = uniqueName("Toys");
  await createAndSelectBucket(page, first);
  await addBox(page).fill("cat wants more treats");

  await createAndSelectBucket(page, second);
  await expect(addBox(page)).toHaveValue("");
  await addBox(page).fill("cat wants a new tree house");

  await selectBucket(page, first);
  await expect(addBox(page)).toHaveValue("cat wants more treats");

  await page.reload();
  await expect(addBox(page)).toHaveValue("cat wants more treats");
  await selectBucket(page, second);
  await expect(addBox(page)).toHaveValue("cat wants a new tree house");
});
