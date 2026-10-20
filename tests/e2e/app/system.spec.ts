import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import { E2E_DATABASE_FILE } from "../helpers/env";

test.use({ storageState: authState("system") });

test("the system tab shows the scheduler to admins", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "system", exact: true }).click();

  await expect(page.getByRole("status").filter({ hasText: "✓ running" })).toBeVisible();
  await expect(page.getByText("recent errors", { exact: true })).toBeVisible();
});

test("admins give a user credits from the system tab", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "system", exact: true }).click();

  await page.getByLabel("user email").fill(specUserEmail("system"));
  await page.getByRole("button", { name: "look up" }).click();
  const balance = page.getByText(/^\d+ credits$/);
  await expect(balance).toBeVisible();
  const before = Number((await balance.textContent())?.match(/(\d+) credits/)?.[1]);

  await page.getByLabel("credits to give").fill("5");
  await page.getByLabel("note").fill("e2e thanks");
  await page.getByRole("button", { name: "give" }).click();

  await expect(page.getByText(`${before + 5} credits`, { exact: true })).toBeVisible();
  await expect(
    page.getByText(/\d+ granted · \d+ used · \d+ refunded · \d+ taken back · \d+ by admins/)
  ).toBeVisible();
  await expect(page.getByText(/^last 30 days · \d+ used · \$\d+\.\d{4} on our ai/)).toBeVisible();

  const activity = page.getByText("e2e thanks · by e2e-system@heycapy.test").first();
  await expect(activity).toBeHidden();
  await page.getByRole("button", { name: "show activity" }).click();
  await expect(activity).toBeVisible();
});

test("admins rename a user and give or take bonus username changes", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-renamed-${stamp}@heycapy.test`;
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare("insert into users (email, username) values (?, ?)").run(email, `old_${stamp}`);
  db.close();

  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "system", exact: true }).click();

  await page.getByLabel("email to find a username").fill(email.toUpperCase());
  await page.getByRole("button", { name: "[ find ]", exact: true }).click();
  const username = page.getByTestId("admin-username");
  await expect(username).toHaveText(`old_${stamp}`);
  await expect(page.getByText("2 of 2 changes left this month")).toBeVisible();
  await expect(page.getByText("never changed")).toBeVisible();

  await page.getByLabel("new username").fill("support");
  await page.getByRole("button", { name: "[ rename ]", exact: true }).click();
  await expect(page.getByText("that username is reserved")).toBeVisible();

  await page.getByLabel("new username").fill(`New_${stamp}`);
  await page.getByRole("button", { name: "[ rename ]", exact: true }).click();
  await expect(username).toHaveText(`new_${stamp}`);
  await expect(page.getByText("that username is reserved")).toHaveCount(0);
  await expect(page.getByText(`old_${stamp} → new_${stamp}`)).toBeVisible();
  await expect(page.getByText(/ · by an admin$/)).toBeVisible();
  await expect(page.getByText("2 of 2 changes left this month")).toBeVisible();

  const bonus = page.getByTestId("admin-username-bonus");
  const take = page.getByRole("button", { name: "[ −1 ]", exact: true });
  await expect(take).toBeDisabled();
  await page.getByRole("button", { name: "[ +1 ]", exact: true }).click();
  await expect(bonus).toHaveText("1 bonus");
  await expect(page.getByText("2 of 2 changes left this month, then 1 bonus")).toBeVisible();
  await take.click();
  await expect(bonus).toHaveText("0 bonus");
  await expect(take).toBeDisabled();
});
