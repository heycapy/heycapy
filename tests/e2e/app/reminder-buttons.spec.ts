import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  expectSelected,
  field,
  openSettings,
  option,
  saveSettings,
  switchTab,
} from "../helpers/settings";
import {
  activeBucketTitle,
  addItem,
  createAndSelectBucket,
  itemRow,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("reminder-buttons") });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

async function reminderButtons(page: Page) {
  const dialog = await openSettings(page);
  await switchTab(dialog, "notifications");
  return { dialog, buttons: field(dialog, "reminder buttons") };
}

test("reminder buttons default to 1 hour + tomorrow and are saved per bucket", async ({ page }) => {
  await createAndSelectBucket(page, uniqueName("Buttons"));
  const { dialog, buttons } = await reminderButtons(page);
  await expectSelected(option(buttons, "15 min"), false);
  await expectSelected(option(buttons, "30 min"), false);
  await expectSelected(option(buttons, "1 hour"));
  await expectSelected(option(buttons, "Tomorrow"));

  await option(buttons, "15 min").click();
  await option(buttons, "Tomorrow").click();
  await saveSettings(dialog);

  const reopened = await reminderButtons(page);
  await expectSelected(option(reopened.buttons, "15 min"));
  await expectSelected(option(reopened.buttons, "1 hour"));
  await expectSelected(option(reopened.buttons, "Tomorrow"), false);
});

test("a notification link opens its item's bucket", async ({ page }) => {
  const target = uniqueName("Bills");
  const title = uniqueName("pay rent");
  await createAndSelectBucket(page, target);
  await addItem(page, title);
  const itemId = (
    await itemRow(page, title)
      .locator("xpath=ancestor::*[starts-with(@id,'item-')][1]")
      .getAttribute("id")
  )?.replace("item-", "");
  const bucketId = await page.evaluate(
    () =>
      (
        JSON.parse(sessionStorage.getItem("heycapy-ui") ?? "{}") as {
          state?: { activeBucketId?: number };
        }
      ).state?.activeBucketId
  );

  await createAndSelectBucket(page, uniqueName("Other"));
  await page.goto(`/?bucket=${bucketId}#item-${itemId}`);

  await expect(activeBucketTitle(page)).toHaveText(target);
  await expect(itemRow(page, title)).toBeInViewport();
  await expect(page).toHaveURL(new RegExp(`/#item-${itemId}$`));
});
