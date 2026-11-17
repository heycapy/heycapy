import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  createAndSelectBucket,
  detailChip,
  itemRow,
  itemTick,
  openDetail,
  saveEdit,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("inline-edit") });

const editor = (page: Page) => page.getByRole("group", { name: "edit item" });
const titleInput = (page: Page) => editor(page).getByRole("textbox", { name: "title" });

async function savedAfter(page: Page, act: () => Promise<void>) {
  const saved = page.waitForResponse(
    (r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]
  );
  await act();
  await saved;
}

async function bucketWith(page: Page, ...titles: string[]) {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Inline"));
  for (const title of titles) await addItem(page, title);
}

test("a click opens the row in place with the title ready to type, and the rest dims", async ({
  page,
}) => {
  const first = uniqueName("water plants");
  const second = uniqueName("feed the cat");
  await bucketWith(page, first, second);

  await itemRow(page, first).click();

  await expect(editor(page)).toBeVisible();
  await expect(titleInput(page)).toBeFocused();
  await expect(titleInput(page)).toHaveValue(first);
  expect(await titleInput(page).evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(
    first.length
  );
  await expect(editor(page).getByRole("button", { name: "date", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "edit item" })).toHaveCount(0);
  await expect
    .poll(() =>
      itemRow(page, second).evaluate(
        (el) => getComputedStyle(el.closest("div.bg-background") ?? el).opacity
      )
    )
    .toBe("0.4");
});

test("Enter saves the title, closes the row and gives the focus back", async ({ page }) => {
  const title = uniqueName("water plants");
  const renamed = uniqueName("water the ferns");
  await bucketWith(page, title);

  await itemRow(page, title).click();
  await titleInput(page).fill(renamed);
  await savedAfter(page, () => page.keyboard.press("Enter"));

  await expect(editor(page)).toHaveCount(0);
  await expect(itemRow(page, renamed)).toBeFocused();
  await page.reload();
  await expect(itemRow(page, renamed)).toBeVisible();
});

test("Escape throws the changes away", async ({ page }) => {
  const title = uniqueName("water plants");
  await bucketWith(page, title);

  await itemRow(page, title).click();
  await titleInput(page).fill("something else");
  await page.keyboard.press("Escape");

  await expect(editor(page)).toHaveCount(0);
  await expect(itemRow(page, title)).toBeFocused();
  await page.reload();
  await expect(itemRow(page, title)).toBeVisible();
});

test("a click outside saves and closes, and never ticks or opens what's under it", async ({
  page,
}) => {
  const first = uniqueName("water plants");
  const second = uniqueName("feed the cat");
  await bucketWith(page, first, second);

  await itemRow(page, first).click();
  await titleInput(page).fill(`${first} daily`);
  await itemTick(page, second).click({ force: true });

  await expect(editor(page)).toHaveCount(0);
  await expect(itemRow(page, `${first} daily`)).toBeVisible();
  await expect(itemTick(page, second)).not.toBeChecked();

  await itemRow(page, second).click();
  await expect(titleInput(page)).toHaveValue(second);
});

test("an empty title keeps the old one while the other changes still save", async ({ page }) => {
  const title = uniqueName("water plants");
  await bucketWith(page, title);

  await itemRow(page, title).click();
  await titleInput(page).fill("");
  await editor(page).getByRole("button", { name: "date", exact: true }).click();
  await page.getByRole("button", { name: "tomorrow", exact: true }).click();
  await page.keyboard.press("Control+Enter");

  await expect(editor(page)).toHaveCount(0);
  await expect(itemRow(page, title)).toContainText("tomorrow");
});

test("a date from the shortcuts gets a time chip, and each chip opens without closing the row", async ({
  page,
}) => {
  const title = uniqueName("dentist");
  await bucketWith(page, title);

  await itemRow(page, title).click();
  await expect(editor(page).getByRole("button", { name: /^time: / })).toHaveCount(0);
  await editor(page).getByRole("button", { name: "date", exact: true }).click();
  await page.getByRole("button", { name: "tomorrow", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "pick a date" })).toHaveCount(0);

  const time = editor(page).getByRole("button", { name: /^time: / });
  await time.click();
  const picker = page.getByRole("dialog", { name: "pick a time" });
  await picker
    .getByRole("group", { name: "hour" })
    .getByRole("button", { name: "4", exact: true })
    .click();
  await picker.getByRole("button", { name: ":30", exact: true }).click();
  await picker.getByRole("button", { name: "pm", exact: true }).click();
  await editor(page)
    .getByRole("button", { name: /^date: / })
    .click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "pick a date" })).toBeVisible();
  await expect(editor(page)).toBeVisible();
  await expect(time).toHaveAccessibleName("time: 4:30 pm");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "pick a date" })).toHaveCount(0);
  await expect(editor(page)).toBeVisible();

  await titleInput(page).click();
  await savedAfter(page, () => page.keyboard.press("Enter"));
  await expect(editor(page)).toHaveCount(0);
  await expect(itemRow(page, title)).toContainText("4:30 pm");
  await page.reload();
  await expect(itemRow(page, title)).toContainText("4:30 pm");
});

test("a click outside while a popover is open only closes the popover", async ({ page }) => {
  const first = uniqueName("water plants");
  const second = uniqueName("feed the cat");
  await bucketWith(page, first, second);

  await itemRow(page, first).click();
  await editor(page).getByRole("button", { name: "date", exact: true }).click();
  const popover = page.getByRole("dialog", { name: "pick a date" });
  await expect(popover).toBeVisible();

  await itemTick(page, second).click({ force: true });
  await expect(popover).toHaveCount(0);
  await expect(editor(page)).toBeVisible();
  await expect(itemTick(page, second)).not.toBeChecked();

  await itemTick(page, second).click({ force: true });
  await expect(editor(page)).toHaveCount(0);
  await expect(itemTick(page, second)).not.toBeChecked();
});

test("no date takes the date and its time away", async ({ page }) => {
  const title = uniqueName("dentist");
  await bucketWith(page, title);

  await itemRow(page, title).click();
  await editor(page).getByRole("button", { name: "date", exact: true }).click();
  await page
    .getByRole("dialog", { name: "pick a date" })
    .getByRole("button", { name: "today", exact: true })
    .click();
  await editor(page)
    .getByRole("button", { name: /^date: / })
    .click();
  await page.getByRole("button", { name: "no date", exact: true }).click();

  await expect(editor(page).getByRole("button", { name: /^time: / })).toHaveCount(0);
  await page.keyboard.press("Control+Enter");
  await expect(editor(page)).toHaveCount(0);
  await expect(itemRow(page, title)).not.toContainText("today");
});

test("repeat needs a date, then opens inside the row and saves with the rest", async ({ page }) => {
  const title = uniqueName("gym");
  await bucketWith(page, title);

  await itemRow(page, title).click();
  await detailChip(editor(page), "repeat").click();
  await expect(detailChip(editor(page), "repeat")).toHaveAttribute("aria-expanded", "false");

  await editor(page).getByRole("button", { name: "date", exact: true }).click();
  await page.getByRole("button", { name: "tomorrow", exact: true }).click();
  await openDetail(editor(page), "repeat");
  await editor(page).getByRole("button", { name: "on", exact: true }).click();
  await editor(page).getByRole("button", { name: "week", exact: true }).click();
  await expect(editor(page)).toBeVisible();

  await saveEdit(editor(page));
  await expect(editor(page)).toHaveCount(0);
  await expect(itemRow(page, title)).toContainText("↺ weekly");
});

test("notes sit under the title as one line, and a click on them puts the cursor there", async ({
  page,
}) => {
  const title = uniqueName("water plants");
  await bucketWith(page, title);

  await itemRow(page, title).click();
  const notes = editor(page).getByRole("textbox", { name: "notes" });
  await notes.fill("the fern first\nthen the cactus");
  await savedAfter(page, () => page.keyboard.press("Control+Enter"));
  await expect(editor(page)).toHaveCount(0);

  const preview = itemRow(page, title).getByText("the fern first");
  await expect(preview).toBeVisible();
  await expect(itemRow(page, title)).not.toContainText("then the cactus");

  await preview.click();
  await expect(notes).toBeFocused();
  await expect(notes).toHaveValue("the fern first\nthen the cactus");

  await notes.fill("");
  await savedAfter(page, () => page.keyboard.press("Control+Enter"));
  await expect(itemRow(page, title)).not.toContainText("the fern first");
});

test("a long title shows on one line in the list and in full in the open row", async ({ page }) => {
  const title = uniqueName("a title that goes on and on ".repeat(8));
  await bucketWith(page, title);
  const row = itemRow(page, title);
  const oneLine = await row
    .locator("span.truncate")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(oneLine).toBeLessThan(30);

  await row.click();
  await expect(titleInput(page)).toHaveValue(title);
});

test("opening a done item doesn't replay its tick", async ({ page }) => {
  const title = uniqueName("water plants");
  await bucketWith(page, title);
  await itemTick(page, title).click();
  await expect(itemTick(page, title)).toBeChecked();
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { tickFrames: Set<string> }).tickFrames = seen;
    const loop = () => {
      const paths = document.querySelectorAll('[role="checkbox"] path');
      const fill = paths[paths.length - 1];
      if (fill) seen.add(getComputedStyle(fill).transform);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await itemRow(page, title).click();
  await expect(editor(page)).toBeVisible();
  await page.waitForTimeout(600);

  const frames = await page.evaluate(() => [
    ...(window as unknown as { tickFrames: Set<string> }).tickFrames,
  ]);
  expect(frames).toEqual(["none"]);
});
