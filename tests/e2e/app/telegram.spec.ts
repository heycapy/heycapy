import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, createBucket, selectBucket, uniqueName } from "../helpers/buckets";
import { closeDialog, expectSelected, openFromSettings, option } from "../helpers/settings";

test.use({ storageState: authState("telegram") });
test.describe.configure({ mode: "default" });

async function openTelegram(page: Page) {
  return openFromSettings(page, "notifications", "[ configure telegram ]", /^telegram config \[/);
}

function aliasInput(dialog: Locator): Locator {
  return dialog.getByPlaceholder("e.g. todo, sub, work");
}

async function saveTelegram(dialog: Locator): Promise<void> {
  await option(dialog, "[ save ]").click();
  await expect(dialog).not.toBeVisible();
}

function uniqueAlias(prefix: string): string {
  return `${prefix}${Date.now()}`.slice(0, 32);
}

let bucketName: string;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  bucketName = uniqueName("Telegram Test");
  await createAndSelectBucket(page, bucketName);
});

test("defaults: common deadline buttons, five time slots, no repeats step", async ({ page }) => {
  const { dialog } = await openTelegram(page);
  await expect(aliasInput(dialog)).toHaveValue("");

  for (const preset of ["today", "tomorrow", "this week", "no deadline"]) {
    await expectSelected(option(dialog, preset));
  }
  for (const preset of ["end of month", "pick date"]) {
    await expectSelected(option(dialog, preset), false);
  }
  for (const slot of ["9am", "12pm", "3pm", "6pm", "9pm"]) {
    await expectSelected(option(dialog, slot));
  }
  await expect(dialog.getByText("5 times configured")).toBeVisible();
  await expectSelected(option(dialog, "off"), false);
});

test("alias is sanitised to telegram command characters and previewed", async ({ page }) => {
  const { dialog } = await openTelegram(page);
  await aliasInput(dialog).fill("My-Alias 2!");
  await expect(aliasInput(dialog)).toHaveValue("myalias2");
  await expect(
    dialog.getByText("type /myalias2 title in telegram to skip the bucket picker")
  ).toBeVisible();
});

test("alias and options persist after save", async ({ page }) => {
  const alias = uniqueAlias("keep");
  let { dialog, settings } = await openTelegram(page);
  await aliasInput(dialog).fill(alias);
  await option(dialog, "end of month").click();
  await option(dialog, "off").click();
  await option(dialog, "monthly").click();
  await saveTelegram(dialog);
  await closeDialog(settings);

  ({ dialog, settings } = await openTelegram(page));
  await expect(aliasInput(dialog)).toHaveValue(alias);
  await expectSelected(option(dialog, "end of month"));
  await expectSelected(option(dialog, "on"));
  await expectSelected(option(dialog, "monthly"));
});

test("rejects an alias that shadows a built-in bot command", async ({ page }) => {
  const { dialog } = await openTelegram(page);
  await aliasInput(dialog).fill("add");
  await option(dialog, "[ save ]").click();
  await expect(
    dialog.getByText("/add is a built-in bot command — pick another alias")
  ).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("rejects an alias already used by another bucket", async ({ page }) => {
  const alias = uniqueAlias("dup");
  let { dialog, settings } = await openTelegram(page);
  await aliasInput(dialog).fill(alias);
  await saveTelegram(dialog);
  await closeDialog(settings);

  const other = uniqueName("Other Telegram");
  await createBucket(page, other);
  await selectBucket(page, other);
  ({ dialog, settings } = await openTelegram(page));
  await aliasInput(dialog).fill(alias);
  await option(dialog, "[ save ]").click();
  await expect(dialog.getByText(`/${alias} is already used by "${bucketName}"`)).toBeVisible();
});

test("alias is capped at telegram's 32 character command limit", async ({ page }) => {
  const { dialog } = await openTelegram(page);
  await aliasInput(dialog).fill("a".repeat(40));
  await expect(aliasInput(dialog)).toHaveValue("a".repeat(32));
});

test("the last remaining deadline button cannot be turned off", async ({ page }) => {
  const { dialog } = await openTelegram(page);
  for (const preset of ["today", "tomorrow", "this week"]) {
    await option(dialog, preset).click();
  }
  await expect(dialog.getByText("1 selected")).toBeVisible();
  await expect(option(dialog, "no deadline")).toBeDisabled();
});

test("custom time slots can be added, validated and removed", async ({ page }) => {
  const { dialog } = await openTelegram(page);
  const input = dialog.getByPlaceholder("e.g. 5:30pm or 17:30");
  const add = option(dialog, "add");

  await input.fill("5:30pm");
  await add.click();
  await expect(dialog.getByRole("button", { name: "remove 5:30pm" })).toBeVisible();
  await expect(dialog.getByText("6 times configured")).toBeVisible();

  await input.fill("25:99");
  await add.click();
  await expect(dialog.getByText("invalid — try 5:30pm or 17:30")).toBeVisible();

  await input.fill("9am");
  await add.click();
  await expect(dialog.getByText("already added")).toBeVisible();

  await dialog.getByRole("button", { name: "remove 5:30pm" }).click();
  await expect(dialog.getByText("5 times configured")).toBeVisible();
});

test("reset to defaults restores the default config", async ({ page }) => {
  const { dialog } = await openTelegram(page);
  await aliasInput(dialog).fill("temp");
  await option(dialog, "pick date").click();
  await dialog.getByRole("button", { name: "reset to defaults" }).click();

  await expect(aliasInput(dialog)).toHaveValue("");
  await expectSelected(option(dialog, "pick date"), false);
});
