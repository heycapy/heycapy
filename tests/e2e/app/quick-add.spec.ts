import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addBox,
  addItemButton,
  itemRow,
  openBucketOnPhone,
  uniqueName,
  untilStill,
  detailChip,
} from "../helpers/buckets";
import { dragDown, fakeKeyboard, setKeyboard } from "../helpers/touch";

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

test("the add box's expand opens a drawer: title and add on one row at the bottom, dragged down to close", async ({
  page,
}) => {
  await openBucketOnPhone(page, uniqueName("Quick"));
  await expect(addItemButton(page)).toHaveCount(1);
  const screen = page.viewportSize() ?? { width: 0, height: 0 };

  const scrolled = () => page.locator("main").evaluate((el) => el.scrollTop);
  const before = await scrolled();
  expect(await tapAndReadFocus(page, () => addItemButton(page).tap())).toBe("TEXTAREA");
  const addForm = addPage(page);
  const title = addForm.locator("textarea");
  const add = addForm.getByRole("button", { name: "[ add ]", exact: true });
  await expect(title).toBeFocused();
  expect(await scrolled()).toBe(before);
  await untilStill(page, addForm);
  await expect
    .poll(async () => {
      const box = await addForm.boundingBox();
      return [box?.x, box?.width];
    })
    .toEqual([0, screen.width]);
  const addAt = await add.boundingBox();
  const titleAt = await title.boundingBox();
  const addMiddle = (addAt?.y ?? 0) + (addAt?.height ?? 0) / 2;
  expect(addMiddle).toBeGreaterThan(titleAt?.y ?? Infinity);
  expect(addMiddle).toBeLessThan((titleAt?.y ?? 0) + (titleAt?.height ?? 0));
  expect((addAt?.y ?? 0) + (addAt?.height ?? 0)).toBeGreaterThan(screen.height - 100);
  await expect(addForm.getByText("x", { exact: true })).not.toBeInViewport();

  await title.fill("cat wants more treats");
  await dragDown(page, addForm.getByRole("heading", { name: "new item" }), 200);
  await expect(addForm).toBeHidden();
  await expect(addBox(page)).toHaveValue("cat wants more treats");

  await addItemButton(page).tap();
  await expect(title).toBeFocused();
  await page.touchscreen.tap(screen.width / 2, 160);
  await expect(addForm).toBeHidden();

  await addItemButton(page).tap();
  const name = uniqueName("first");
  await title.fill(name);
  await add.tap();
  await expect(addForm).not.toBeVisible();
  await expect(itemRow(page, name)).toBeVisible();

  expect(await tapAndReadFocus(page, () => itemRow(page, name).tap())).toBe("TEXTAREA");
  const edit = page.getByRole("dialog", { name: "edit item" });
  const editTitle = edit.locator("textarea");
  await expect(editTitle).toBeFocused();
  expect(await editTitle.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(
    name.length
  );
  await editTitle.fill(`${name} changed`);
  await dragDown(page, edit.getByRole("heading", { name: "edit item" }), 200);
  await expect(edit).toBeHidden();
  await expect(itemRow(page, name)).toBeVisible();
  await expect(itemRow(page, `${name} changed`)).toHaveCount(0);
});

test("while typing, the drawer sits on the keyboard and stays clear of the header", async ({
  page,
}) => {
  await fakeKeyboard(page);
  await openBucketOnPhone(page, uniqueName("Keyboard"));
  const screen = page.viewportSize() ?? { width: 0, height: 0 };
  await addBox(page).fill("cat wants more treats tomorrow");
  await addItemButton(page).tap();
  const addForm = addPage(page);
  const add = addForm.getByRole("button", { name: "[ add ]", exact: true });
  await detailChip(addForm, "repeat").tap();
  await addForm.getByRole("button", { name: "on", exact: true }).tap();
  const headerBottom = async () => {
    const box = await page.locator("header").boundingBox();
    return (box?.y ?? 0) + (box?.height ?? 0);
  };

  await setKeyboard(page, 360);
  await expect
    .poll(async () => {
      const box = await add.boundingBox();
      return (box?.y ?? Infinity) + (box?.height ?? 0);
    })
    .toBeLessThanOrEqual(screen.height - 360);
  await expect
    .poll(async () => (await addForm.boundingBox())?.y ?? 0)
    .toBeGreaterThanOrEqual(await headerBottom());

  await setKeyboard(page, 0);
  await expect
    .poll(async () => {
      const box = await add.boundingBox();
      return (box?.y ?? 0) + (box?.height ?? 0);
    })
    .toBeGreaterThan(screen.height - 100);
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
