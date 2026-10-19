import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, uniqueName } from "../helpers/buckets";
import {
  expectSelected,
  field,
  openSettings,
  option,
  saveSettings,
  switchTab,
} from "../helpers/settings";

test.use({ storageState: authState("bucket-defaults") });
// the tests share one user and its defaults in tweaks
test.describe.configure({ mode: "serial" });

async function openDefaults(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "[ ··· ]", exact: true }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  const box = page.getByRole("group", { name: "bucket defaults" });
  await expect(box).toBeVisible();
  return box;
}

async function saveTweaks(page: Page) {
  await page.getByRole("button", { name: "[ save ]", exact: true }).click();
  await expect(page.getByText("unsaved changes", { exact: true })).toBeHidden();
}

test("a new bucket starts on the defaults from tweaks and shows they come from there", async ({
  page,
}) => {
  const defaults = await openDefaults(page);
  await defaults.getByRole("button", { name: "[ + add ]", exact: true }).click();
  await option(defaults, "1 day before").click();
  await option(field(defaults, "keep reminding"), "daily").click();
  await saveTweaks(page);

  await createAndSelectBucket(page, uniqueName("Defaults"));
  const settings = await openSettings(page);
  await switchTab(settings, "notifications");

  await expect(
    settings.getByRole("button", { name: "remove reminder 1 day before" })
  ).toBeVisible();
  await expectSelected(option(field(settings, "keep reminding"), "daily"));
  for (const label of ["channels", "remind at", "keep reminding", "notify when overdue"]) {
    await expect(field(settings, label).getByText("from tweaks", { exact: true })).toBeVisible();
  }
});

test("changing a setting in the bucket makes it the bucket's own, use tweaks puts it back", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Own"));
  let settings = await openSettings(page);
  await switchTab(settings, "notifications");
  const repeat = field(settings, "keep reminding");
  await option(repeat, "once").click();
  await expect(repeat.getByRole("button", { name: "use tweaks", exact: true })).toBeVisible();
  await expect(field(settings, "remind at").getByText("from tweaks")).toBeVisible();
  await saveSettings(settings);

  settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await expectSelected(option(field(settings, "keep reminding"), "once"));
  await field(settings, "keep reminding").getByRole("button", { name: "use tweaks" }).click();
  await expectSelected(option(field(settings, "keep reminding"), "daily"));
  await saveSettings(settings);

  settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await expect(field(settings, "keep reminding").getByText("from tweaks")).toBeVisible();
  await expectSelected(option(field(settings, "keep reminding"), "daily"));
});

test("changing tweaks changes the buckets that follow it", async ({ page }) => {
  await page.goto("/");
  const name = uniqueName("Follows");
  await createAndSelectBucket(page, name);

  const defaults = await openDefaults(page);
  await option(field(defaults, "keep reminding"), "once").click();
  await saveTweaks(page);

  await page.goto("/");
  await page.getByRole("button", { name, exact: true }).click();
  const settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await expectSelected(option(field(settings, "keep reminding"), "once"));
});
