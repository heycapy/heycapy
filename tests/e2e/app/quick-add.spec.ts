import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItemButton, itemRow, openBucketOnPhone, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("quick-add"), hasTouch: true });

function addPage(page: Page) {
  return page.getByRole("dialog", { name: "new item" });
}

// iOS raises the keyboard only when focus happens inside the tap. A window listener runs
// after React's handler, at the end of the same click, so this reads what the tap focused
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

test("the bottom bar's add opens a full screen page with cancel and add at the bottom", async ({
  page,
}) => {
  await openBucketOnPhone(page, uniqueName("Quick"));
  await expect(addItemButton(page)).toHaveCount(1);

  expect(await tapAndReadFocus(page, () => addItemButton(page).tap())).toBe("TEXTAREA");
  const addForm = addPage(page);
  const title = addForm.locator("textarea");
  const add = addForm.getByRole("button", { name: "[ add ]", exact: true });
  await expect(title).toBeFocused();
  // Cancel and add sit at the bottom of the screen, under the form
  await expect(add).toBeVisible();
  await expect(title).toBeVisible();
  const addBox = await add.boundingBox();
  const titleBox = await title.boundingBox();
  expect(addBox?.y ?? 0).toBeGreaterThan(titleBox?.y ?? Infinity);

  await addForm.getByRole("button", { name: "[ cancel ]", exact: true }).tap();
  await expect(addForm).not.toBeVisible();

  await addItemButton(page).tap();
  const name = uniqueName("first");
  await title.fill(name);
  await add.tap();
  await expect(addForm).not.toBeVisible();
  await expect(itemRow(page, name)).toBeVisible();

  expect(await tapAndReadFocus(page, () => itemRow(page, name).tap())).toBe("TEXTAREA");
  const editTitle = page.getByRole("dialog", { name: "edit item" }).locator("textarea");
  await expect(editTitle).toBeFocused();
  // Cursor at the end of the existing title, ready to keep typing
  expect(await editTitle.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(
    name.length
  );
});

test("tapping the empty space under the list opens the add page", async ({ page }) => {
  await openBucketOnPhone(page, uniqueName("Empty tap"));

  const box = await page.locator("main").boundingBox();
  if (!box) throw new Error("main has no box");
  expect(
    await tapAndReadFocus(page, () =>
      page.touchscreen.tap(box.x + box.width / 2, box.y + box.height - 200)
    )
  ).toBe("TEXTAREA");
  const addForm = addPage(page);
  await expect(addForm).toBeVisible();

  const name = uniqueName("from empty space");
  await addForm.locator("textarea").fill(name);
  await addForm.getByRole("button", { name: "[ add ]", exact: true }).tap();
  await expect(itemRow(page, name)).toBeVisible();
});
