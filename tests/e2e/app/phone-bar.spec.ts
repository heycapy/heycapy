import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  addItemButton,
  createAndSelectBucket,
  editForm,
  itemRow,
  openBucketOnPhone,
  openItemMenu,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("phone-bar"), hasTouch: true });

test("capy in the bottom bar opens the chat as a drawer on phones", async ({ page }) => {
  await openBucketOnPhone(page, uniqueName("Capy"));
  await expect(page.getByRole("button", { name: "Open chat" })).toBeHidden();

  await page.getByRole("button", { name: "chat with capy" }).tap();
  const chat = page.getByRole("dialog", { name: "chat with capy" });
  await expect(chat.getByText("Hi there! How can I help you today?")).toBeVisible();
  await expect(chat.getByPlaceholder("ask capy...")).not.toBeFocused();
  await expect.poll(() => chat.evaluate((el) => el.scrollTop)).toBe(0);

  await chat.getByRole("button", { name: "[ history ]", exact: true }).tap();
  const history = page.getByRole("dialog", { name: "chat history" });
  await expect(history).toBeVisible();
  await history.getByRole("button", { name: "[ x ]", exact: true }).tap();
  await expect(history).toBeHidden();
  await expect(chat).toBeVisible();

  await page.touchscreen.tap(195, 60);
  await expect(chat).toBeHidden();

  // capy stays in the bottom bar on wide screens too, never also floating over the list
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("button", { name: "chat with capy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open chat" })).toBeHidden();
});

test("the bottom bar is easy to tap and clear of the screen's rounded bottom", async ({ page }) => {
  const bucket = uniqueName("Sizes");
  await openBucketOnPhone(page, bucket);
  const screenHeight = page.viewportSize()?.height ?? 0;

  // the expand button fills the add box's height inside its 2px border
  for (const [control, height] of [
    [page.getByTestId("add-box"), 48],
    [addItemButton(page), 44],
    [page.getByRole("button", { name: "chat with capy" }), 48],
  ] as const) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(height);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(screenHeight - 8);
  }
});

test("search opens as a drawer with the box at the bottom, results above it", async ({ page }) => {
  const bucket = uniqueName("Find");
  await openBucketOnPhone(page, bucket);
  const title = uniqueName("lost keys");
  await addItemButton(page).tap();
  const form = page.getByRole("dialog", { name: "new item" });
  await form.locator("textarea").first().fill(title);
  await form.getByRole("button", { name: "[ add ]", exact: true }).tap();
  await expect(form).toBeHidden();

  await page.getByRole("button", { name: "search", exact: true }).tap();
  const search = page.getByRole("dialog", { name: "search" });
  const box = search.getByRole("textbox", { name: "search all items" });
  await expect(box).toBeFocused();
  await box.fill(title);
  const row = search.getByRole("button", { name: title });
  await expect(row).toBeVisible();

  const rowBox = await row.boundingBox();
  const inputBox = await box.boundingBox();
  const screenHeight = page.viewportSize()?.height ?? 0;
  expect((rowBox?.y ?? 0) + (rowBox?.height ?? 0)).toBeLessThanOrEqual(inputBox?.y ?? 0);
  expect((inputBox?.y ?? 0) + (inputBox?.height ?? 0)).toBeGreaterThan(screenHeight - 80);

  await row.tap();
  const edit = page.getByRole("dialog", { name: "edit item" });
  await edit.getByRole("button", { name: "[ cancel ]", exact: true }).tap();
  await expect(edit).toBeHidden();
  await expect(search).toBeVisible();

  await page.touchscreen.tap(195, 60);
  await expect(search).toHaveCount(0);

  await page.getByRole("button", { name: "search", exact: true }).tap();
  await expect(search).toBeVisible();
  const header = await search.getByRole("heading", { name: "search every bucket" }).boundingBox();
  const x = (header?.x ?? 0) + 40;
  const y = (header?.y ?? 0) + 5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(x, y + step * 25);
  await page.mouse.up();
  await expect(search).toHaveCount(0);
});

test("on a laptop the chat grows above capy, clear of the add box, and capy closes it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Wide chat"));
  const capy = page.getByRole("button", { name: "chat with capy" });
  await capy.click();
  const chat = page.getByPlaceholder("ask capy...");
  await expect(chat).toBeVisible();
  await expect(capy).toHaveAttribute("aria-expanded", "true");

  const panel = page.locator("div.fixed").filter({ has: chat }).last();
  const addBoxTop = (await page.getByTestId("add-box").boundingBox())?.y ?? 0;
  const capyBox = await capy.boundingBox();
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      return (box?.y ?? 0) + (box?.height ?? 0);
    })
    .toBeLessThanOrEqual(addBoxTop);
  // it grows out of capy
  await expect
    .poll(async () => (await panel.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(440);
  const panelBox = await panel.boundingBox();
  expect(
    Math.abs(
      (panelBox?.x ?? 0) + (panelBox?.width ?? 0) - ((capyBox?.x ?? 0) + (capyBox?.width ?? 0))
    )
  ).toBeLessThanOrEqual(2);

  await capy.click();
  await expect(chat).toBeHidden();
  await expect(capy).toHaveAttribute("aria-expanded", "false");
});

test("on a wide screen the chat stands beside the list, which moves over for it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Docked chat"));
  const title = uniqueName("a long title that would sit under the chat");
  await addItem(page, title);
  const row = itemRow(page, title);
  const capy = page.getByRole("button", { name: "chat with capy" });
  const listCentre = async () => {
    const box = await page.getByTestId("add-box").boundingBox();
    return (box?.x ?? 0) + (box?.width ?? 0) / 2;
  };
  const centredAlone = await listCentre();

  await capy.click();
  const input = page.getByPlaceholder("ask capy...");
  await expect(input).toBeFocused();
  const panel = page.locator("div.fixed").filter({ has: input }).last();
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      return [box?.y, box?.height, Math.round((box?.x ?? 0) + (box?.width ?? 0))];
    })
    .toEqual([0, 900, 1440]);
  const chatLeft = (await panel.boundingBox())?.x ?? 0;
  await expect
    .poll(async () => {
      const box = await row.boundingBox();
      return (box?.x ?? 0) + (box?.width ?? 0);
    })
    .toBeLessThanOrEqual(chatLeft);
  await expect.poll(listCentre).toBeLessThan(centredAlone - 100);
  const topLine = (selector: string, from: string) =>
    page.evaluate(
      ([sel, start]) => document.querySelector(start)?.closest(sel)?.getBoundingClientRect().top,
      [selector, from]
    );
  expect(await topLine(".border-t-2", '[placeholder="ask capy..."]')).toBe(
    await topLine(".sticky", '[data-testid="add-box"]')
  );
  await expect(panel.getByRole("button", { name: "Collapse" })).toHaveCount(0);

  await row.click();
  await expect(editForm(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editForm(page)).toBeHidden();

  await page.keyboard.press("ControlOrMeta+\\");
  await expect(input).toBeHidden();
  await expect(capy).toHaveAttribute("aria-expanded", "false");
  await expect.poll(listCentre).toBeCloseTo(centredAlone, 0);
});

test("toasts centre on the list while the chat is beside it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Docked toast"));
  const title = uniqueName("bins");
  await addItem(page, title);
  await page.getByRole("button", { name: "chat with capy" }).click();
  await expect(page.getByPlaceholder("ask capy...")).toBeFocused();

  await openItemMenu(page, title);
  await page
    .getByRole("button", { name: /delete/ })
    .last()
    .click();
  const toast = page.locator("[data-sonner-toast]", { hasText: title });
  await expect(toast).toBeVisible();
  const list = await page.getByTestId("add-box").boundingBox();
  const listCentre = (list?.x ?? 0) + (list?.width ?? 0) / 2;
  await expect
    .poll(async () => {
      const box = await toast.boundingBox();
      return Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - listCentre);
    })
    .toBeLessThanOrEqual(40);
});

test("on a wide screen tweaks stands beside the list like the chat, and the list stays usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Docked tweaks"));
  const title = uniqueName("a row to click while tweaks is open");
  await addItem(page, title);

  await page.getByRole("button", { name: "your menu" }).click();
  await page.getByRole("button", { name: "tweaks", exact: true }).click();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await expect
    .poll(async () => {
      const box = await tweaks.boundingBox();
      return [box?.y, box?.height, Math.round((box?.x ?? 0) + (box?.width ?? 0))];
    })
    .toEqual([0, 900, 1440]);
  const tweaksLeft = (await tweaks.boundingBox())?.x ?? 0;
  const addBox = page.getByTestId("add-box");
  const box = await addBox.boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(tweaksLeft);

  const input = addBox.locator("input");
  await input.fill("half typed");
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await itemRow(page, title).click();
  await expect(editForm(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editForm(page)).toBeHidden();
  await expect(tweaks).toBeVisible();

  await tweaks.getByRole("button", { name: "notifications", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(tweaks).toBeHidden();
});

test("one panel at the side at a time: the chat, tweaks, trash, what's new", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("One side"));
  const capy = page.getByRole("button", { name: "chat with capy" });
  const chatInput = page.getByPlaceholder("ask capy...");
  const fromMenu = async (item: string | RegExp) => {
    await page.getByRole("button", { name: "your menu" }).click();
    await page.getByRole("button", { name: item, exact: typeof item === "string" }).click();
  };
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  const trash = page.getByRole("dialog", { name: "trash" });
  const whatsNew = page.getByRole("dialog", { name: "what's new" });

  await capy.click();
  await expect(chatInput).toBeVisible();
  await fromMenu("tweaks");
  await expect(tweaks).toBeVisible();
  await expect(chatInput).toBeHidden();

  await fromMenu("trash");
  await expect(trash).toBeVisible();
  await expect(tweaks).toBeHidden();

  await fromMenu(/^what's new/);
  await expect(whatsNew).toBeVisible();
  await expect(trash).toBeHidden();
  await expect(page.locator("[data-modal-panel]")).toHaveCount(1);

  await capy.click();
  await expect(chatInput).toBeVisible();
  await expect(whatsNew).toBeHidden();
});

test("tweaks with unsaved changes asks before the chat takes its place", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Unsaved side"));
  await page.getByRole("button", { name: "your menu" }).click();
  await page.getByRole("button", { name: "tweaks", exact: true }).click();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await tweaks.getByRole("button", { name: "personality", exact: true }).click();
  await tweaks.getByRole("textbox").first().fill("jarvis");

  const capy = page.getByRole("button", { name: "chat with capy" });
  await capy.click();
  const warning = tweaks.getByRole("alertdialog", { name: "unsaved changes" });
  await expect(warning).toBeVisible();
  await expect(page.getByPlaceholder("ask capy...")).toBeHidden();

  await warning.getByRole("button", { name: "discard" }).click();
  await expect(tweaks).toBeHidden();
  await capy.click();
  await expect(page.getByPlaceholder("ask capy...")).toBeVisible();
});
