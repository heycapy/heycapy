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

function pixels(canvas: Locator) {
  return canvas.locator("rect");
}

test("drawing with drag, mirror, fill and undo, then saving keeps the avatar", async ({ page }) => {
  const canvas = await openAvatarEditor(page);
  const save = page.getByRole("button", { name: "[ save avatar ]" });
  await expect(save).toBeDisabled();
  await expect(pixels(canvas)).toHaveCount(0);

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
  await expect(page.locator("header").getByRole("img", { name: "your avatar" })).toBeVisible();

  const saved = await canvas.innerHTML();
  const reopened = await openAvatarEditor(page);
  await expect(reopened.locator("rect.fill-avatar-8")).toHaveCount(1);
  expect(await reopened.innerHTML()).toBe(saved);
});

test("removing the avatar clears it, and undo brings the drawing back to save again", async ({
  page,
}) => {
  const canvas = await openAvatarEditor(page);
  await expect(pixels(canvas)).not.toHaveCount(0);
  await expect(page.locator("header").getByRole("img", { name: "your avatar" })).toBeVisible();

  await page.getByRole("button", { name: "[ remove avatar ]" }).click();
  await expect(page.getByRole("status").filter({ hasText: "avatar removed." })).toBeVisible();
  await expect(pixels(canvas)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "[ remove avatar ]" })).toHaveCount(0);
  await expect(page.locator("header").getByRole("img", { name: "your avatar" })).toHaveCount(0);

  await page.getByRole("button", { name: "[ undo ]" }).click();
  await expect(pixels(canvas)).not.toHaveCount(0);
  await expect(page.getByRole("button", { name: "[ save avatar ]" })).toBeEnabled();

  const reopened = await openAvatarEditor(page);
  await expect(pixels(reopened)).toHaveCount(0);
});
