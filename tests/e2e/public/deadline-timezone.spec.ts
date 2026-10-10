import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { MONTH_SHORT_NAMES } from "@/constants";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { itemRow } from "../helpers/buckets";
import { login, uniqueEmail } from "../helpers/login";
import { modal } from "../helpers/settings";

test.use({ timezoneId: "Asia/Kolkata" });

const DAY_MS = 86_400_000;

function userId(db: Database.Database, email: string): number {
  return (db.prepare("select id from users where email = ?").get(email) as { id: number }).id;
}

// A bucket the India owner shares with the London member, holding an all-day item set in India
function seedSharedItem(ownerEmail: string, memberEmail: string, title: string, day: string) {
  const db = new Database(E2E_DATABASE_FILE);
  const owner = userId(db, ownerEmail);
  const member = userId(db, memberEmail);
  db.prepare("update user_settings set timezone = 'Asia/Kolkata' where user_id = ?").run(owner);
  const { id: bucketId } = db
    .prepare("insert into buckets (user_id, name) values (?, ?) returning id")
    .get(owner, `shared ${Date.now()}`) as { id: number };
  db.prepare("insert into bucket_members (bucket_id, user_id) values (?, ?)").run(bucketId, member);
  const midnightInIndia = Date.parse(`${day}T00:00:00+05:30`) / 1000;
  const { id: itemId } = db
    .prepare(
      "insert into items (bucket_id, user_id, title, deadline, deadline_timezone) values (?, ?, ?, ?, 'Asia/Kolkata') returning id"
    )
    .get(bucketId, owner, title, midnightInIndia) as { id: number };
  db.close();
  return { bucketId, itemId, midnightInIndia };
}

function savedDeadline(itemId: number) {
  const db = new Database(E2E_DATABASE_FILE);
  const row = db
    .prepare("select deadline, deadline_timezone as zone from items where id = ?")
    .get(itemId);
  db.close();
  return row;
}

async function expectAllDayOn(page: Page, title: string, label: string) {
  const row = itemRow(page, title);
  await expect(row).toContainText(label);
  await expect(row).not.toContainText(/\d(am|pm)/);
}

test("an all-day item set in India is on the same date in London, and saving it there keeps it", async ({
  page,
  browser,
}) => {
  const ownerEmail = uniqueEmail("e2e-zone-owner");
  await login(page, ownerEmail);
  const london = await browser.newContext({ timezoneId: "Europe/London" });
  const member = await london.newPage();
  const memberEmail = uniqueEmail("e2e-zone-member");
  await login(member, memberEmail);

  const day = new Date(Date.now() + 3 * DAY_MS).toISOString().slice(0, 10);
  const label = `${MONTH_SHORT_NAMES[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
  const title = `pay rent ${Date.now()}`;
  const { bucketId, itemId, midnightInIndia } = seedSharedItem(ownerEmail, memberEmail, title, day);

  await page.goto(`/?bucket=${bucketId}`);
  await expectAllDayOn(page, title, label);

  await member.goto(`/?bucket=${bucketId}`);
  await expectAllDayOn(member, title, label);

  await itemRow(member, title).click();
  const dialog = modal(member, /^edit item$/);
  await expect(dialog.getByRole("button", { name: /all day/ })).toBeVisible();
  const renamed = `${title} (paid by Sam)`;
  await dialog.locator("textarea").fill(renamed);
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await expectAllDayOn(member, renamed, label);
  expect(savedDeadline(itemId)).toEqual({ deadline: midnightInIndia, zone: "Asia/Kolkata" });
  await london.close();
});
