import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { touchSwipe } from "../helpers/touch";
import {
  addBox,
  addItem,
  addItemButton,
  createAndSelectBucket,
  newItemForm,
  openBucketOnPhone,
  itemTick,
  openItemMenu,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("toasts") });

async function deleteFromMenu(page: Page, title: string, tap: boolean) {
  await openItemMenu(page, title);
  const remove = page.getByRole("button", { name: /delete/ }).last();
  if (tap) await remove.tap();
  else await remove.click();
}

function centreX(box: { x: number; width: number } | null) {
  return (box?.x ?? 0) + (box?.width ?? 0) / 2;
}

test.describe("on a phone", () => {
  test.use({ hasTouch: true });

  test("a toast sits just above the add bar, centred and only as wide as its text", async ({
    page,
  }) => {
    await openBucketOnPhone(page, uniqueName("Toast"));
    const title = uniqueName("bins");
    await addBox(page).fill(title);
    await addBox(page).press("Enter");
    await deleteFromMenu(page, title, true);

    const toast = page.locator("[data-sonner-toast]", { hasText: title });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCSS("opacity", "1");
    const box = await toast.boundingBox();
    const bar = await addBox(page).boundingBox();
    expect((box?.y ?? Infinity) + (box?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
    const screenWidth = page.viewportSize()?.width ?? 0;
    expect(box?.width ?? Infinity).toBeLessThan(screenWidth - 32);
    expect(Math.abs(centreX(box) - screenWidth / 2)).toBeLessThanOrEqual(4);
  });

  test("a toast can be swiped away", async ({ page }) => {
    await openBucketOnPhone(page, uniqueName("Toast swipe"));
    const title = uniqueName("bins");
    await addBox(page).fill(title);
    await addBox(page).press("Enter");
    await deleteFromMenu(page, title, true);

    const toast = page.locator("[data-sonner-toast]", { hasText: title });
    await expect(toast).toBeVisible();
    await touchSwipe(page, toast, 250);
    await expect(toast).toHaveCount(0);
  });
});

test("on desktop a toast is dragged away downward only", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Toast drag"));
  const title = uniqueName("bins");
  await addItem(page, title);
  await deleteFromMenu(page, title, false);

  const toast = page.locator("[data-sonner-toast]", { hasText: title });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS("user-select", "none");
  const box = await toast.boundingBox();
  if (!box) throw new Error("no toast");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 150, y, { steps: 10 });
  await page.mouse.up();
  await expect(toast).toBeVisible();

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 120, { steps: 10 });
  await page.mouse.up();
  await expect(toast).toHaveCount(0);
});

test("every toast has a cross that closes it", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Toast cross"));
  const title = uniqueName("bins");
  await addItem(page, title);
  await deleteFromMenu(page, title, false);

  const toast = page.locator("[data-sonner-toast]", { hasText: title });
  await expect(toast.getByRole("button", { name: "dismiss" })).toBeVisible();
  await toast.getByRole("button", { name: "dismiss" }).click();
  await expect(toast).toHaveCount(0);
});

test("on a wide screen a toast sits centred over the list and stays in view over an open form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Toast"));
  const title = uniqueName("bins");
  await addItem(page, title);
  await deleteFromMenu(page, title, false);
  await addItemButton(page).click();
  await expect(newItemForm(page)).toBeVisible();

  const toast = page.locator("[data-sonner-toast]", { hasText: title });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCSS("opacity", "1");
  const list = await page.locator("main").boundingBox();
  expect(Math.abs(centreX(await toast.boundingBox()) - centreX(list))).toBeLessThanOrEqual(4);
  const onTop = await toast.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && el.contains(hit);
  });
  expect(onTop).toBe(true);
});

test("no more than three toasts at once, the oldest goes first", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Toast cap"));
  const titles = [uniqueName("one"), uniqueName("two"), uniqueName("three"), uniqueName("four")];
  for (const title of titles) await addItem(page, title);
  for (const title of titles) {
    await deleteFromMenu(page, title, false);
    await expect(page.locator("[data-sonner-toast]", { hasText: title })).toHaveCount(1);
  }

  await expect(page.locator("[data-sonner-toast]")).toHaveCount(3);
  await expect(page.locator("[data-sonner-toast]", { hasText: titles[0] })).toHaveCount(0);
});

test("an error is announced at once, can be retried, and escape closes it", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Toast error"));
  const title = uniqueName("call bank");
  await addItem(page, title);

  await page.route("**/*", (route) =>
    route.request().headers()["next-action"] ? route.abort() : route.fallback()
  );
  await itemTick(page, title).click();
  const error = page.getByRole("alert").filter({ hasText: "couldn't save that" });
  await expect(error).toBeVisible();
  await expect(error.getByRole("button", { name: "retry" })).toBeVisible();

  await error.getByRole("button", { name: "dismiss" }).focus();
  await page.keyboard.press("Escape");
  await expect(error).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
