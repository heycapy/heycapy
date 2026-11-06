import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItemButton,
  createAndSelectBucket,
  openBucketOnPhone,
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

test("on wide screens the chat grows above capy, clear of the add box, and capy closes it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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
