import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { login, uniqueEmail } from "../helpers/login";

function setUsername(email: string, username: string): void {
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare("update users set username = ? where email = ?").run(username, email);
  db.close();
}

async function openAccount(page: Page) {
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "account", exact: true }).click();
  await expect(page.getByTestId("username-allowance")).toBeVisible();
  return page.getByRole("textbox", { name: "username" });
}

const check = (page: Page) => page.getByTestId("username-check");
const allowance = (page: Page) => page.getByTestId("username-allowance");
const button = (page: Page, label: string) =>
  page.getByRole("button", { name: `[ ${label} ]`, exact: true });

test("a username is checked as it's typed, saved with its own button, and limited", async ({
  page,
}) => {
  const stamp = Date.now();
  const takenEmail = uniqueEmail("e2e-username-taken");
  await login(page, takenEmail);
  setUsername(takenEmail, `taken_${stamp}`);
  await page.context().clearCookies();

  const email = uniqueEmail("e2e-username");
  await login(page, email);
  setUsername(email, `first_${stamp}`);
  const field = await openAccount(page);
  await expect(field).toHaveValue(`first_${stamp}`);
  await expect(allowance(page)).toHaveText("2 of 2 changes left this month");
  await expect(button(page, "save username")).toHaveCount(0);

  await field.fill("ab");
  await expect(check(page)).toHaveText("a username needs at least 3 characters");
  await expect(button(page, "save username")).toBeDisabled();

  await field.fill(`Taken_${stamp}`);
  await expect(field).toHaveValue(`taken_${stamp}`);
  await expect(check(page)).toHaveText("that username is taken");
  await expect(button(page, "save username")).toBeDisabled();

  await field.fill(`second_${stamp}`);
  await expect(check(page)).toHaveText("✓ available");
  await button(page, "save username").click();
  await expect(allowance(page)).toHaveText("1 of 2 changes left this month");
  await expect(field).toHaveValue(`second_${stamp}`);
  await expect(button(page, "save username")).toHaveCount(0);

  await button(page, "generate another").click();
  await expect(field).not.toHaveValue(`second_${stamp}`);
  await expect(check(page)).toHaveText("✓ available");
  const generated = await field.inputValue();
  await button(page, "save username").click();
  await expect(
    page.getByText(`rename to ${generated}? that's your last change this month`)
  ).toBeVisible();
  await button(page, "cancel").click();
  await expect(allowance(page)).toHaveText("1 of 2 changes left this month");

  await button(page, "save username").click();
  await button(page, "confirm").click();
  await expect(allowance(page)).toHaveText(/^no changes left · the next one opens on /);
  await expect(field).toHaveValue(generated);
  await expect(field).toBeDisabled();
  await expect(button(page, "generate another")).toHaveCount(0);

  await page.reload();
  const reopened = await openAccount(page);
  await expect(reopened).toHaveValue(generated);
  await expect(reopened).toBeDisabled();
});

test("an unsaved username survives a tab switch, and closing warns without a save", async ({
  page,
}) => {
  const email = uniqueEmail("e2e-username-draft");
  await login(page, email);
  const field = await openAccount(page);
  const draft = `draft_${Date.now()}`;
  await field.fill(draft);

  await page.getByRole("button", { name: "appearance", exact: true }).click();
  await page.getByRole("button", { name: "account", exact: true }).click();
  await expect(field).toHaveValue(draft);
  await page.getByRole("button", { name: "appearance", exact: true }).click();

  const close = page.getByRole("button", { name: "[ x ]", exact: true });
  await close.click();
  const warning = page.getByRole("alertdialog", { name: "unsaved changes" });
  await expect(warning).toContainText("your new username isn't saved yet");
  await expect(warning.getByRole("button", { name: "[ save ]", exact: true })).toHaveCount(0);
  await warning.getByRole("button", { name: "[ keep editing ]", exact: true }).click();
  await expect(field).toHaveValue(draft);

  await button(page, "cancel").click();
  await expect(field).not.toHaveValue(draft);
  await close.click();
  await expect(warning).toHaveCount(0);
  await expect(field).toHaveCount(0);
});
