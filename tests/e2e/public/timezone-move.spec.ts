import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { login, uniqueEmail } from "../helpers/login";

test.use({ timezoneId: "Europe/London" });

function savedTimezone(email: string): string {
  const db = new Database(E2E_DATABASE_FILE);
  const row = db
    .prepare(
      "select s.timezone from user_settings s join users u on u.id = s.user_id where u.email = ?"
    )
    .get(email) as { timezone: string };
  db.close();
  return row.timezone;
}

test("someone with no buckets yet gets their browser's timezone saved", async ({ page }) => {
  const email = uniqueEmail("e2e-tz-new");
  await login(page, email);
  await expect(page.getByRole("button", { name: "···" })).toBeVisible();

  await expect.poll(() => savedTimezone(email)).toBe("Europe/London");
});

// Signed up in India, now opening the app in London
async function backFromIndia(page: Page): Promise<string> {
  const email = uniqueEmail("e2e-tz-move");
  await login(page, email);
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    "update user_settings set timezone = 'Asia/Kolkata' where user_id = (select id from users where email = ?)"
  ).run(email);
  db.close();
  await page.reload();
  return email;
}

const notice = (page: Page) =>
  page.getByRole("status").filter({ hasText: "you seem to be in UK now" });

test("someone on another clock can move their reminders to it", async ({ page }) => {
  const email = await backFromIndia(page);
  await expect(notice(page)).toContainText(
    "you seem to be in UK now · reminders still run on India time"
  );

  await notice(page).getByRole("button", { name: "[ update ]", exact: true }).click();

  await expect(notice(page)).toHaveCount(0);
  await expect.poll(() => savedTimezone(email)).toBe("Europe/London");
  await page.reload();
  await expect(page.getByRole("button", { name: "···" })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});

test("someone who keeps their clock isn't asked again in that place", async ({ page }) => {
  const email = await backFromIndia(page);

  await notice(page).getByRole("button", { name: "[ keep India ]", exact: true }).click();

  await expect(notice(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "···" })).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
  expect(savedTimezone(email)).toBe("Asia/Kolkata");
});
