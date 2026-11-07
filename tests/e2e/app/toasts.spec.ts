import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addBox,
  addItem,
  addItemButton,
  createAndSelectBucket,
  newItemForm,
  openBucketOnPhone,
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

test.describe("on a phone", () => {
  test.use({ hasTouch: true });

  test("a toast sits at the top, centred and only as wide as its text", async ({ page }) => {
    await openBucketOnPhone(page, uniqueName("Toast"));
    const title = uniqueName("bins");
    await addBox(page).fill(title);
    await addBox(page).press("Enter");
    await deleteFromMenu(page, title, true);

    const toast = page.locator("[data-sonner-toast]", { hasText: title });
    await expect(toast).toBeVisible();
    await expect.poll(async () => (await toast.boundingBox())?.y ?? Infinity).toBeLessThan(80);
    const box = await toast.boundingBox();
    const screenWidth = page.viewportSize()?.width ?? 0;
    expect(box?.width ?? Infinity).toBeLessThan(screenWidth - 32);
    const left = box?.x ?? 0;
    const right = screenWidth - left - (box?.width ?? 0);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(4);
  });
});

test("on a wide screen a toast sits bottom left and stays in view over an open form", async ({
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
  const box = await toast.boundingBox();
  expect(box?.x ?? Infinity).toBeLessThanOrEqual(24);
  const onTop = await toast.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.right - 8, r.top + r.height / 2);
    return !!hit && el.contains(hit);
  });
  expect(onTop).toBe(true);
});
