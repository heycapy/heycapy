import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addBox,
  addItem,
  addItemButton,
  createAndSelectBucket,
  editForm,
  itemRow,
  newItemForm,
  selectBucket,
  uniqueName,
  untilStill,
} from "../helpers/buckets";

test.use({ storageState: authState("drafts") });

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
  const dialog = newItemForm(page);
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
  const dialog = newItemForm(page);
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

test("on a wide screen the form grows out of the add box and folds back on a click outside", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Box"));
  const kept = uniqueName("cat wants a bigger box");
  await addItem(page, kept);
  const box = await page.getByTestId("add-box").boundingBox();
  const capy = await page.getByRole("button", { name: "chat with capy" }).boundingBox();

  await addBox(page).fill("cat wants more treats");
  await addItemButton(page).click();
  const form = newItemForm(page);
  await expect(form).toContainText(/in Box/);
  const title = form.locator("textarea").first();
  await expect(title).toBeFocused();
  await expect
    .poll(async () => {
      const panel = await form.boundingBox();
      return panel ? [panel.x, panel.x + panel.width, panel.y + panel.height] : null;
    })
    .toEqual([box?.x, (capy?.x ?? 0) + (capy?.width ?? 0), (box?.y ?? 0) + (box?.height ?? 0)]);
  await expect(form.getByText("status", { exact: true })).toHaveCount(0);
  const titleBox = await title.boundingBox();
  const whenBox = await form.getByRole("button", { name: "pick date" }).boundingBox();
  expect(titleBox?.y).toBeGreaterThan(whenBox?.y ?? Infinity);

  await itemRow(page, kept).click();
  await expect(form).toBeHidden();
  await expect(editForm(page)).toBeHidden();
  await itemRow(page, kept).click();
  await expect(editForm(page)).toBeVisible();
  await expect(editForm(page).getByText("status", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await addItemButton(page).click();
  await expect(title).toHaveValue("cat wants more treats");
  await expect(title).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(form).toBeHidden();
  await expect(addBox(page)).toBeFocused();
  await expect(addBox(page)).toHaveValue("cat wants more treats");
});

test("in the panel a typed date is undone on the title row, and turning repeat on shows its options", async ({
  page,
}) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.setViewportSize({ width: 1280, height: 560 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Repeat"));
  await addBox(page).fill("cat wants more treats tomorrow");
  await addItemButton(page).click();
  const form = newItemForm(page);
  await expect(form.getByText(/^due /)).toHaveCount(0);
  await expect(form.getByRole("button", { name: "not a date" })).toBeVisible();

  await form.getByRole("button", { name: "on", exact: true }).click();
  await expect(form.getByText("every", { exact: true })).toBeInViewport({ ratio: 1 });
});

test("the item added last is marked for a few seconds, from the box or the form", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Mark"));
  const marked = page.locator("[data-just-added]");
  const first = uniqueName("cat wants treats");
  const second = uniqueName("cat wants a box");

  await addBox(page).fill(first);
  await addBox(page).press("Enter");
  await expect(marked).toHaveCount(1);
  await expect(marked).toContainText(first);

  await addItem(page, second);
  await expect(marked).toHaveCount(1);
  await expect(marked).toContainText(second);
  await expect(marked).toHaveCount(0, { timeout: 6000 });
});

test("editing opens the same panel from the footer, and closing gives focus back to the row", async ({
  page,
}) => {
  await page.goto("/");
  const bucket = uniqueName("Edit");
  await createAndSelectBucket(page, bucket);
  const title = uniqueName("cat's bowl is empty");
  await addItem(page, title);
  const capy = await page.getByRole("button", { name: "chat with capy" }).boundingBox();

  await itemRow(page, title).focus();
  await page.keyboard.press("Enter");
  const edit = editForm(page);
  await expect(edit).toContainText(`in ${bucket}`);
  await expect(edit.locator("textarea").first()).toHaveValue(title);
  await expect(edit.getByText("status", { exact: true })).toBeVisible();
  await expect(edit.getByRole("button", { name: "delete item" })).toBeVisible();
  await expect
    .poll(async () => {
      const panel = await edit.boundingBox();
      return panel ? panel.x + panel.width : null;
    })
    .toBe((capy?.x ?? 0) + (capy?.width ?? 0));

  await page.keyboard.press("Escape");
  await expect(edit).toBeHidden();
  await expect(itemRow(page, title)).toBeFocused();
});

test("Ctrl/Cmd+Enter adds or saves from any field of the form", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Keys"));
  const title = uniqueName("cat wants a new tree house");
  await addBox(page).fill(title);
  await addItemButton(page).click();
  const form = newItemForm(page);
  await form.getByRole("button", { name: "pick date" }).focus();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toBeHidden();
  await expect(itemRow(page, title)).toBeVisible();
  await expect(page.locator("[data-just-added]")).toHaveCount(1);

  await itemRow(page, title).click();
  const edit = editForm(page);
  await edit.locator("textarea").first().fill(`${title} today`);
  await edit.getByRole("button", { name: "completed", exact: true }).focus();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(edit).toBeHidden();
  await expect(itemRow(page, `${title} today`)).toBeVisible();

  const once = uniqueName("cat wants a bigger box");
  await addItemButton(page).click();
  await form.locator("textarea").first().fill(once);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toBeHidden();
  await expect(itemRow(page, once)).toHaveCount(1);
});

test("Enter in the form's title starts a new line, and it grows to 4 lines before scrolling", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Lines"));
  const first = uniqueName("cat's list");
  await addItemButton(page).click();
  const form = newItemForm(page);
  const title = form.locator("textarea").first();
  await title.fill(first);
  const oneLine = (await title.boundingBox())?.height ?? 0;

  await title.press("Enter");
  await title.pressSequentially("treats");
  await expect(form).toBeVisible();
  await expect(title).toHaveValue(`${first}\ntreats`);
  const twoLines = (await title.boundingBox())?.height ?? 0;
  const line = twoLines - oneLine;
  expect(line).toBeGreaterThan(0);

  for (const word of ["greens", "a box", "a tree house", "more treats"]) {
    await title.press("Enter");
    await title.pressSequentially(word);
  }
  expect((await title.boundingBox())?.height).toBeCloseTo(oneLine + 3 * line, 0);
  expect(await title.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form).toBeHidden();
  const row = page.getByRole("button", { name: new RegExp(first) });
  await expect(row).toBeVisible();
  const lines = row.locator("span.block.truncate");
  await expect(lines).toHaveText([first, "treats", "greens", "a box …"]);
});

test("a click on the list only folds the open panel away, it doesn't open what's under it", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Fold"));
  const first = uniqueName("cat's bowl");
  const second = uniqueName("cat's tree");
  await addItem(page, first);
  await addItem(page, second);
  const edit = editForm(page);

  await itemRow(page, first).click();
  await expect(edit.locator("textarea").first()).toHaveValue(first);
  await itemRow(page, first).click();
  await expect(edit).toBeHidden();
  await page.waitForTimeout(300);
  await expect(edit).toBeHidden();

  await itemRow(page, first).click();
  await expect(edit).toBeVisible();
  await itemRow(page, second).click();
  await expect(edit).toBeHidden();

  await itemRow(page, second).click();
  await expect(edit.locator("textarea").first()).toHaveValue(second);
});

test("the form's height follows a section opening in it, instead of jumping", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Grow"));
  await addBox(page).fill("cat wants more treats tomorrow");
  await addItemButton(page).click();
  const form = newItemForm(page);
  await expect(form.locator("textarea").first()).toBeFocused();
  await untilStill(page, form);
  const before = (await form.boundingBox())?.height ?? 0;

  const heights = form.evaluate((el) => {
    const seen: number[] = [];
    return new Promise<number[]>((resolve) => {
      const started = performance.now();
      const sample = () => {
        seen.push(el.getBoundingClientRect().height);
        if (performance.now() - started < 600) requestAnimationFrame(sample);
        else resolve(seen);
      };
      requestAnimationFrame(sample);
    });
  });
  await form.getByRole("button", { name: "on", exact: true }).click();
  const seen = await heights;
  const after = seen[seen.length - 1] ?? 0;

  expect(after).toBeGreaterThan(before + 40);
  expect(seen.some((h) => h > before + 2 && h < after - 2)).toBe(true);
});
