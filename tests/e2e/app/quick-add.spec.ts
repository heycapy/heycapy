import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  inlineEditor,
  newItemForm,
  addItemButton,
  itemRow,
  openBucketOnPhone,
  uniqueName,
  untilStill,
} from "../helpers/buckets";

test.use({ storageState: authState("quick-add"), hasTouch: true });

async function tapAndReadFocus(page: Page, tap: () => Promise<void>): Promise<string> {
  await page.evaluate(() => {
    window.addEventListener(
      "click",
      () => {
        document.body.dataset.focusAtTap = document.activeElement?.tagName ?? "";
      },
      { once: true }
    );
  });
  await tap();
  return (await page.locator("body").getAttribute("data-focus-at-tap")) ?? "";
}

test("on a phone the add button opens the new item in the list, the same row as an open item", async ({
  page,
}) => {
  await openBucketOnPhone(page, uniqueName("Quick"));
  await expect(addItemButton(page)).toHaveCount(1);

  const scrolled = () => page.locator("main").evaluate((el) => el.scrollTop);
  const before = await scrolled();
  await addItemButton(page).tap();
  const addForm = newItemForm(page);
  const title = addForm.locator("textarea").first();
  const add = addForm.getByRole("button", { name: "add", exact: true });
  await expect(title).toBeFocused();
  expect(await scrolled()).toBe(before);
  await untilStill(page, addForm);
  await expect(add).toBeDisabled();

  await title.fill("cat wants more treats");
  await page.touchscreen.tap(10, 10);
  await expect(addForm).toBeHidden();

  await addItemButton(page).tap();
  await expect(title).toHaveValue("cat wants more treats");
  const name = uniqueName("first");
  await title.fill(name);
  await add.tap();
  await expect(addForm).not.toBeVisible();
  await expect(itemRow(page, name)).toBeVisible();

  await addItemButton(page).tap();
  await expect(title).toHaveValue("");
  await page.keyboard.press("Escape");

  expect(await tapAndReadFocus(page, () => itemRow(page, name).tap())).toBe("TEXTAREA");
  const edit = inlineEditor(page);
  const editTitle = edit.getByRole("textbox", { name: "title" });
  await expect(editTitle).toBeFocused();
  expect(await editTitle.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(
    name.length
  );
  await editTitle.fill(`${name} changed`);
  await page.keyboard.press("Escape");
  await expect(edit).toBeHidden();
  await expect(itemRow(page, name)).toBeVisible();
  await expect(itemRow(page, `${name} changed`)).toHaveCount(0);
});
