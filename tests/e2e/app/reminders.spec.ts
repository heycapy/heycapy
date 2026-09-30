import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal, openSettings, saveSettings, switchTab } from "../helpers/settings";

test.use({ storageState: authState("reminders") });

test("an item can have several reminders, added from presets or typed, and removed", async ({
  page,
}) => {
  const morning = new Date();
  morning.setHours(8, 0, 0, 0);
  await page.clock.setFixedTime(morning);
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Reminders"));
  const title = uniqueName("flight");

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = modal(page, /^(new|edit) item$/);
  await dialog.locator("textarea").first().fill(title);
  await expect(dialog.getByText("reminders", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: String(morning.getDate()), exact: true }).click();

  await expect(dialog.getByText("bucket default · 1 of 4")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "remove reminder at time" })).toBeVisible();

  await dialog.getByRole("button", { name: "[ + add ]", exact: true }).click();
  await dialog.getByRole("button", { name: "1 hour before", exact: true }).click();
  await expect(dialog.getByText("2 of 4", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "[ + add ]", exact: true }).click();
  await dialog.getByRole("textbox", { name: "custom reminder amount" }).fill("3");
  await dialog
    .getByRole("group", { name: "custom reminder unit" })
    .getByRole("button", { name: "days", exact: true })
    .click();
  await dialog.getByRole("button", { name: "add custom reminder" }).click();

  const chips = dialog.getByRole("button", { name: /^remove reminder / });
  await expect(chips).toHaveText(["3 days before ×", "1 hour before ×", "at time ×"]);
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await itemRow(page, title).click();
  await expect(chips).toHaveText(["3 days before ×", "1 hour before ×", "at time ×"]);
  await dialog.getByRole("button", { name: "remove reminder at time" }).click();
  await expect(chips).toHaveText(["3 days before ×", "1 hour before ×"]);
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await itemRow(page, title).click();
  await expect(chips).toHaveText(["3 days before ×", "1 hour before ×"]);
});

test("a typed reminder over 90 days is refused, and four is the limit", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Limits"));

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = modal(page, /^(new|edit) item$/);
  await dialog.locator("textarea").first().fill(uniqueName("renew passport"));
  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: "20", exact: true }).click();

  await dialog.getByRole("button", { name: "[ + add ]", exact: true }).click();
  await dialog.getByRole("textbox", { name: "custom reminder amount" }).fill("13");
  await dialog
    .getByRole("group", { name: "custom reminder unit" })
    .getByRole("button", { name: "weeks", exact: true })
    .click();
  await dialog.getByRole("button", { name: "add custom reminder" }).click();
  await expect(dialog.getByText("up to 90 days before")).toBeVisible();
  await dialog.getByRole("button", { name: "[ cancel ]", exact: true }).click();

  for (const preset of ["15 min before", "30 min before", "1 hour before"]) {
    await dialog.getByRole("button", { name: "[ + add ]", exact: true }).click();
    await dialog.getByRole("button", { name: preset, exact: true }).click();
  }
  await expect(dialog.getByRole("button", { name: /^remove reminder / })).toHaveCount(4);
  await expect(dialog.getByText("4 of 4", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "[ + add ]", exact: true })).toHaveCount(0);
  await expect(dialog.getByText(/remove one to add another/)).toBeVisible();

  await dialog.getByRole("button", { name: "remove reminder 15 min before" }).click();
  await expect(dialog.getByText("3 of 4", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "[ + add ]", exact: true })).toBeVisible();
});

test("new items start with the bucket's default reminders", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Bills"));
  const settings = await openSettings(page);
  await switchTab(settings, "notifications");
  await settings.getByRole("button", { name: "[ + add ]", exact: true }).click();
  await settings.getByRole("button", { name: "2 days before", exact: true }).click();
  await saveSettings(settings);

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = modal(page, /^(new|edit) item$/);
  await dialog.locator("textarea").first().fill(uniqueName("electricity"));
  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: "20", exact: true }).click();
  await expect(dialog.getByText("bucket default · 2 of 4")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^remove reminder / })).toHaveText([
    "2 days before ×",
    /^(at time|on the day) ×$/,
  ]);
});
