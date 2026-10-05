import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("quiet-hours") });
// the tests share one user and each leaves quiet hours off for the next
test.describe.configure({ mode: "serial" });

async function openTweaks(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "[ ··· ]", exact: true }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  const box = page
    .locator("div")
    .filter({ has: page.getByText("quiet hours", { exact: true }) })
    .last();
  await expect(box.getByText(/reminders and alerts can arrive|nothing is sent/)).toBeVisible();
  return box;
}

const saveBar = (page: Page) => page.getByText("unsaved changes", { exact: true });
const barButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `[ ${name} ]`, exact: true });

test("quiet hours are off by default and saved with the save bar", async ({ page }) => {
  let box = await openTweaks(page);
  await expect(box.getByText("reminders and alerts can arrive at any time")).toBeVisible();
  await expect(saveBar(page)).toBeHidden();

  await box.getByRole("button", { name: "on", exact: true }).click();
  await expect(
    box.getByText("nothing is sent 10pm–7am, on any channel; reminders due then arrive at 7am")
  ).toBeVisible();
  await expect(saveBar(page)).toBeVisible();
  await barButton(page, "save").click();
  await expect(saveBar(page)).toBeHidden();

  box = await openTweaks(page);
  await expect(box.getByText(/nothing is sent 10pm–7am/)).toBeVisible();
  await box.getByRole("button", { name: "off", exact: true }).click();
  await barButton(page, "save").click();

  box = await openTweaks(page);
  await expect(box.getByText("reminders and alerts can arrive at any time")).toBeVisible();
});

test("the save bar only shows while something differs from what's saved", async ({ page }) => {
  const box = await openTweaks(page);
  for (const tab of ["appearance", "ai", "personality", "account", "notifications"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(saveBar(page)).toBeHidden();
  }

  await box.getByRole("button", { name: "on", exact: true }).click();
  await expect(saveBar(page)).toBeVisible();
  await box.getByRole("button", { name: "off", exact: true }).click();
  await expect(saveBar(page)).toBeHidden();

  await box.getByRole("button", { name: "on", exact: true }).click();
  await barButton(page, "discard").click();
  await expect(saveBar(page)).toBeHidden();
  await expect(box.getByText("reminders and alerts can arrive at any time")).toBeVisible();
});

test("closing with unsaved changes asks first", async ({ page }) => {
  const box = await openTweaks(page);
  await box.getByRole("button", { name: "on", exact: true }).click();
  const warning = page.getByRole("alertdialog", { name: "unsaved changes" });

  await page.getByRole("button", { name: "[ x ]", exact: true }).first().click();
  await expect(warning).toBeVisible();
  await warning.getByRole("button", { name: "[ keep editing ]" }).click();
  await expect(warning).toBeHidden();
  await expect(box.getByText(/nothing is sent 10pm–7am/)).toBeVisible();

  await page.getByRole("button", { name: "[ x ]", exact: true }).first().click();
  await warning.getByRole("button", { name: "[ discard ]" }).click();
  await expect(page.getByText("tweaks", { exact: true })).toBeHidden();

  const reopened = await openTweaks(page);
  await expect(reopened.getByText("reminders and alerts can arrive at any time")).toBeVisible();

  await reopened.getByRole("button", { name: "on", exact: true }).click();
  await page.getByRole("button", { name: "[ x ]", exact: true }).first().click();
  await warning.getByRole("button", { name: "[ save ]" }).click();
  await expect(page.getByText("tweaks", { exact: true })).toBeHidden();

  const saved = await openTweaks(page);
  await expect(saved.getByText(/nothing is sent 10pm–7am/)).toBeVisible();
  await saved.getByRole("button", { name: "off", exact: true }).click();
  await barButton(page, "save").click();
});
