import { test, expect, type Locator } from "@playwright/test";
import { login, uniqueEmail } from "../helpers/login";
import { addItem, editForm, itemRow, openBucketOnPhone, uniqueName } from "../helpers/buckets";

test.use({
  storageState: { cookies: [], origins: [] },
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

// Phones fire the click a little after the finger lifts, later than a zero timeout
async function tapWithLateClick(target: Locator) {
  await target.evaluate(async (el) => {
    const init = { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", init));
    el.dispatchEvent(new PointerEvent("pointerup", init));
    await new Promise((resolve) => setTimeout(resolve, 50));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

test("a tap outside the drawer only closes it, and the next tap opens a row", async ({ page }) => {
  await login(page, uniqueEmail("e2e-outside-tap"));
  await openBucketOnPhone(page, uniqueName("tap"));
  for (const title of ["first", "second", "third"]) await addItem(page, title);

  await itemRow(page, "third").tap();
  await expect(editForm(page)).toBeVisible();
  await tapWithLateClick(itemRow(page, "first"));
  await expect(editForm(page)).toBeHidden();
  await expect(page.getByRole("dialog", { name: "edit item" })).toHaveCount(0);

  await itemRow(page, "first").tap();
  await expect(editForm(page)).toBeVisible();
  await expect(editForm(page).locator("textarea").first()).toHaveValue("first");
});
