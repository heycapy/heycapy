import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addBox, openBucketOnPhone, openItemMenu, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("toasts"), hasTouch: true });

test("a toast sits above the bottom bar, only as wide as its text", async ({ page }) => {
  await openBucketOnPhone(page, uniqueName("Toast"));
  const title = uniqueName("bins");
  await addBox(page).fill(title);
  await addBox(page).press("Enter");
  await openItemMenu(page, title);
  await page
    .getByRole("button", { name: /delete/ })
    .last()
    .tap();

  const toast = page.locator("[data-sonner-toast]", { hasText: title });
  await expect(toast).toContainText(title);
  const addBoxTop = (await page.getByTestId("add-box").boundingBox())?.y ?? 0;
  // it slides up into place
  await expect
    .poll(async () => {
      const box = await toast.boundingBox();
      return (box?.y ?? 0) + (box?.height ?? 0);
    })
    .toBeLessThanOrEqual(addBoxTop);
  const toastBox = await toast.boundingBox();
  const screenWidth = page.viewportSize()?.width ?? 0;
  expect(toastBox?.width ?? Infinity).toBeLessThan(screenWidth - 32);
  const left = toastBox?.x ?? 0;
  const right = screenWidth - left - (toastBox?.width ?? 0);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(4);
});
