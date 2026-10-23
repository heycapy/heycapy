import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("avatar"), viewport: { width: 1280, height: 1100 } });
test.describe.configure({ mode: "serial" });

async function openAvatarEditor(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "account", exact: true }).click();
  const canvas = page.getByTestId("avatar-canvas");
  await expect(page.getByRole("button", { name: "[ undo ]" })).toBeVisible();
  await expect(canvas).not.toHaveClass(/opacity-50/);
  return canvas;
}

async function cellPoint(canvas: Locator, x: number, y: number) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not on screen");
  const cell = box.width / 16;
  return { x: box.x + (x + 0.5) * cell, y: box.y + (y + 0.5) * cell };
}

async function drag(page: Page, canvas: Locator, from: [number, number], to: [number, number]) {
  const start = await cellPoint(canvas, ...from);
  const end = await cellPoint(canvas, ...to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // two big jumps: the cells in between must still be painted
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2);
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
}

// by its label, not its role: an open modal hides the header from the accessibility tree
function header(page: Page) {
  return page.locator('header [aria-label="your avatar"]');
}

function pixels(canvas: Locator) {
  return canvas.locator("rect");
}

test("drawing with drag, mirror, fill and undo, then saving keeps the avatar", async ({ page }) => {
  const canvas = await openAvatarEditor(page);
  const save = page.getByRole("button", { name: "[ save avatar ]" });
  const hint = page.getByTestId("avatar-hint");
  await expect(save).toBeDisabled();
  await expect(hint).toHaveText(/this one was made for you/);
  await expect(pixels(canvas)).toHaveCount(await header(page).locator("rect").count());

  await page.getByRole("button", { name: "[ clear ]" }).click();
  await expect(pixels(canvas)).toHaveCount(0);
  await expect(hint).toHaveText(/an empty avatar can't be saved/);
  await expect(page.getByRole("button", { name: "[ use the one made for me ]" })).toBeEnabled();
  await expect(page.getByTestId("avatar-previews").locator("rect")).not.toHaveCount(0);

  await page.getByRole("button", { name: "red", exact: true }).click();
  await drag(page, canvas, [0, 0], [7, 0]);
  await expect(pixels(canvas)).toHaveCount(1);
  await expect(pixels(canvas).first()).toHaveAttribute("width", "8");

  await page.getByRole("button", { name: "mirror", exact: true }).click();
  await page.getByRole("button", { name: "blue", exact: true }).click();
  await drag(page, canvas, [0, 2], [3, 2]);
  await expect(canvas.locator("rect.fill-avatar-d")).toHaveCount(2);
  await expect(canvas.locator('rect.fill-avatar-d[x="12"][y="2"]')).toHaveAttribute("width", "4");

  await page.getByRole("button", { name: "[ undo ]" }).click();
  await expect(canvas.locator("rect.fill-avatar-d")).toHaveCount(0);
  await page.getByRole("button", { name: "[ redo ]" }).click();
  await expect(canvas.locator("rect.fill-avatar-d")).toHaveCount(2);

  await page.getByRole("button", { name: "mirror", exact: true }).click();
  await page.getByRole("button", { name: "fill", exact: true }).click();
  await page.getByRole("button", { name: "yellow", exact: true }).click();
  const empty = await cellPoint(canvas, 8, 0);
  await page.mouse.click(empty.x, empty.y);
  await expect(canvas.locator('rect.fill-avatar-a[x="8"][y="0"]')).toHaveAttribute("width", "8");

  await expect(page.getByTestId("avatar-previews").locator("svg")).toHaveCount(6);
  await save.click();
  await expect(page.getByRole("status").filter({ hasText: "saved." })).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(hint).toHaveCount(0);

  const saved = await canvas.innerHTML();
  const reopened = await openAvatarEditor(page);
  await expect(reopened.locator("rect.fill-avatar-8")).toHaveCount(1);
  expect(await reopened.innerHTML()).toBe(saved);
});

test("removing the avatar goes back to the generated one, and undo brings the drawing back", async ({
  page,
}) => {
  const canvas = await openAvatarEditor(page);
  await expect(canvas.locator("rect.fill-avatar-8")).toHaveCount(1);
  const drawn = await header(page).innerHTML();

  await page.getByRole("button", { name: "[ remove avatar ]" }).click();
  await page.getByRole("button", { name: "[ cancel ]" }).click();
  await expect(canvas.locator("rect.fill-avatar-8")).toHaveCount(1);
  await expect(header(page).locator("rect.fill-avatar-8")).toHaveCount(1);

  await page.getByRole("button", { name: "[ remove avatar ]" }).click();
  await expect(
    page.getByText("remove your avatar? people will see the one made for you.")
  ).toBeVisible();
  await page.getByRole("button", { name: "[ confirm ]" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "removed. people now see the one made for you." })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "[ remove avatar ]" })).toHaveCount(0);
  await expect(page.getByTestId("avatar-hint")).toHaveText(/this one was made for you/);
  await expect.poll(() => header(page).innerHTML()).not.toBe(drawn);
  await expect(pixels(canvas)).toHaveCount(await header(page).locator("rect").count());

  await page.getByRole("button", { name: "[ undo ]" }).click();
  await expect(canvas.locator("rect.fill-avatar-8")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "[ save avatar ]" })).toBeEnabled();

  const reopened = await openAvatarEditor(page);
  await expect(page.getByTestId("avatar-hint")).toHaveText(/this one was made for you/);
  await expect(pixels(reopened)).toHaveCount(await header(page).locator("rect").count());
});

test("saving an empty drawing goes back to the generated one too", async ({ page }) => {
  const canvas = await openAvatarEditor(page);
  await page.getByRole("button", { name: "red", exact: true }).click();
  await drag(page, canvas, [0, 0], [15, 0]);
  await page.getByRole("button", { name: "[ save avatar ]" }).click();
  await expect(page.getByRole("status").filter({ hasText: "saved." })).toBeVisible();

  await page.getByRole("button", { name: "[ clear ]" }).click();
  await page.getByRole("button", { name: "[ use the one made for me ]" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "removed. people now see the one made for you." })
  ).toBeVisible();
  await expect(pixels(canvas)).not.toHaveCount(0);
  await expect(page.getByRole("button", { name: "[ remove avatar ]" })).toHaveCount(0);
});

test("closing tweaks with an unsaved drawing asks first, and switching tabs keeps it", async ({
  page,
}) => {
  const canvas = await openAvatarEditor(page);
  await page.getByRole("button", { name: "[ clear ]" }).click();
  await page.getByRole("button", { name: "green", exact: true }).click();
  await drag(page, canvas, [0, 8], [15, 8]);

  await page.getByRole("button", { name: "appearance", exact: true }).click();
  await page.getByRole("button", { name: "account", exact: true }).click();
  await expect(canvas.locator('rect.fill-avatar-b[width="16"]')).toHaveCount(1);

  const close = page
    .getByRole("dialog", { name: "tweaks" })
    .getByRole("button", { name: "[ x ]", exact: true });
  const warning = page.getByRole("alertdialog", { name: "unsaved changes" });
  await close.click();
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "[ keep editing ]" }).click();
  await expect(canvas.locator('rect.fill-avatar-b[width="16"]')).toHaveCount(1);

  await close.click();
  await warning.getByRole("button", { name: "[ discard ]" }).click();
  await expect(page.getByRole("dialog", { name: "tweaks" })).toHaveCount(0);
  const reopened = await openAvatarEditor(page);
  await expect(reopened.locator('rect.fill-avatar-b[width="16"]')).toHaveCount(0);

  await page.getByRole("button", { name: "[ clear ]" }).click();
  await page.getByRole("button", { name: "green", exact: true }).click();
  await drag(page, reopened, [0, 8], [15, 8]);
  await close.click();
  await warning.getByRole("button", { name: "[ save ]" }).click();
  await expect(page.getByRole("dialog", { name: "tweaks" })).toHaveCount(0);
  await expect(header(page).locator('rect.fill-avatar-b[width="16"]')).toHaveCount(1);
});

test("picking a preset draws it on the canvas, undo takes it back, and it saves like a drawing", async ({
  page,
}) => {
  const canvas = await openAvatarEditor(page);
  const before = await canvas.innerHTML();
  const presets = page.getByRole("group", { name: "start from" });
  await expect(presets.getByRole("button")).toHaveCount(12);

  await presets.getByRole("button", { name: "frog", exact: true }).click();
  await expect(canvas.locator("rect.fill-avatar-b").first()).toBeVisible();
  await page.getByRole("button", { name: "[ undo ]" }).click();
  expect(await canvas.innerHTML()).toBe(before);
  await page.getByRole("button", { name: "[ redo ]" }).click();

  await page.getByRole("button", { name: "red", exact: true }).click();
  await drag(page, canvas, [0, 15], [15, 15]);
  await page.getByRole("button", { name: "[ save avatar ]" }).click();
  await expect(page.getByRole("status").filter({ hasText: "saved." })).toBeVisible();
  await expect(header(page).locator("rect.fill-avatar-b").first()).toBeVisible();
  await expect(header(page).locator('rect.fill-avatar-8[y="15"][width="16"]')).toHaveCount(1);
});
