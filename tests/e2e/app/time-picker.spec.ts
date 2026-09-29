import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal } from "../helpers/settings";

test.use({ storageState: authState("time-picker") });

test("a time can be picked from the grid or typed, and is saved", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Times"));
  const title = uniqueName("dentist");

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = modal(page, /^(new|edit) item$/);
  await dialog.locator("textarea").first().fill(title);
  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: String(new Date().getDate()), exact: true }).click();

  await dialog.getByRole("button", { name: /^time: / }).click();
  const picker = page.getByRole("dialog", { name: "pick a time" });
  await picker
    .getByRole("group", { name: "hour" })
    .getByRole("button", { name: "4", exact: true })
    .click();
  await picker.getByRole("button", { name: ":30", exact: true }).click();
  await picker.getByRole("button", { name: "pm", exact: true }).click();
  await picker.getByRole("button", { name: "[ done ]", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "time: 4:30 pm" })).toBeVisible();
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, title)).toContainText("4:30pm");

  await itemRow(page, title).click();
  await dialog.getByRole("button", { name: /^time: / }).click();
  const typed = picker.getByRole("textbox", { name: "type a time" });
  await typed.pressSequentially("9");
  await expect(typed).toHaveValue("9:");
  await typed.pressSequentially("37p");
  await expect(typed).toHaveValue("9:37 pm");
  await typed.press("Enter");
  await expect(picker).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "time: 9:37 pm" })).toBeVisible();
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(itemRow(page, title)).toContainText("9:37pm");

  await itemRow(page, title).click();
  await dialog.getByRole("button", { name: /^time: / }).click();
  await typed.pressSequentially("5");
  await typed.press("Enter");
  await expect(dialog.getByRole("button", { name: "time: 5 pm" })).toBeVisible();
});

test("a date without a time shows as all day, and a time can be taken off again", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("All day"));
  const title = uniqueName("pay rent");

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = modal(page, /^(new|edit) item$/);
  await dialog.locator("textarea").first().fill(title);
  await dialog.getByRole("button", { name: "pick date" }).click();
  await page.getByRole("button", { name: "28", exact: true }).click();
  // A date picked fresh starts at 9am, as before
  await expect(dialog.getByRole("button", { name: "time: 9 am" })).toBeVisible();

  await dialog.getByRole("button", { name: /^time: / }).click();
  const picker = page.getByRole("dialog", { name: "pick a time" });
  await picker.getByRole("button", { name: "all day", exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "time: all day" })).toBeVisible();
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, title)).not.toContainText("9am");

  // Opening an all-day item shows all day, not a made-up 9 am
  await itemRow(page, title).click();
  await expect(dialog.getByRole("button", { name: "time: all day" })).toBeVisible();
  await dialog.getByRole("button", { name: /^time: / }).click();
  await picker
    .getByRole("group", { name: "hour" })
    .getByRole("button", { name: "6", exact: true })
    .click();
  await picker.getByRole("button", { name: "[ done ]", exact: true }).click();
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(itemRow(page, title)).toContainText("6am");
});
