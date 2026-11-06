import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addBox, addItemButton, itemRow, openBucketOnPhone, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("quick-add"), hasTouch: true });

function addPage(page: Page) {
  return page.getByRole("dialog", { name: "new item" });
}

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

test("on a phone the add box adds from the bottom bar without leaving the list", async ({
  page,
}) => {
  await openBucketOnPhone(page, uniqueName("Box"));
  await addBox(page).tap();
  await expect(addBox(page)).toBeFocused();

  const first = uniqueName("milk");
  await addBox(page).fill(first);
  await addBox(page).press("Enter");
  await expect(itemRow(page, first)).toBeVisible();
  await expect(addPage(page)).toHaveCount(0);

  const second = uniqueName("bread");
  await addBox(page).fill(second);
  await addBox(page).press("Enter");
  await expect(itemRow(page, second)).toBeVisible();
  await expect(addBox(page)).toBeFocused();
});

test("the add box's expand opens a full screen page with cancel and add at the bottom", async ({
  page,
}) => {
  await openBucketOnPhone(page, uniqueName("Quick"));
  await expect(addItemButton(page)).toHaveCount(1);

  expect(await tapAndReadFocus(page, () => addItemButton(page).tap())).toBe("TEXTAREA");
  const addForm = addPage(page);
  const title = addForm.locator("textarea");
  const add = addForm.getByRole("button", { name: "[ add ]", exact: true });
  await expect(title).toBeFocused();
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
  expect(await editTitle.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(
    name.length
  );
});

test("tapping the empty space under the list puts the cursor in the add box", async ({ page }) => {
  await openBucketOnPhone(page, uniqueName("Empty tap"));

  const box = await page.locator("main").boundingBox();
  if (!box) throw new Error("main has no box");
  expect(
    await tapAndReadFocus(page, () =>
      page.touchscreen.tap(box.x + box.width / 2, box.y + box.height - 200)
    )
  ).toBe("INPUT");
  await expect(addBox(page)).toBeFocused();
  await expect(addPage(page)).toHaveCount(0);
});
