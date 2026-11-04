import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { itemRow, openReminderDetails } from "../helpers/buckets";
import { login, uniqueEmail } from "../helpers/login";
import { giveOwnSmtp } from "../helpers/email";

const DAY_S = 86_400;

function userId(db: Database.Database, email: string): number {
  return (db.prepare("select id from users where email = ?").get(email) as { id: number }).id;
}

// A shared bucket with an item assigned to the member, who alone is reminded about it
function seedAssignedItem(ownerEmail: string, memberEmail: string, title: string) {
  giveOwnSmtp(ownerEmail);
  giveOwnSmtp(memberEmail);
  const db = new Database(E2E_DATABASE_FILE);
  const owner = userId(db, ownerEmail);
  const member = userId(db, memberEmail);
  const { id: bucketId } = db
    .prepare(
      "insert into buckets (user_id, name, notifications_rules) values (?, ?, ?) returning id"
    )
    .get(owner, `shared ${Date.now()}`, "{}") as { id: number };
  db.prepare("insert into bucket_members (bucket_id, user_id) values (?, ?)").run(bucketId, member);
  // Everyone in it picked email for their reminders
  db.prepare("update bucket_members set channels = ? where bucket_id = ?").run(
    JSON.stringify({ medium: ["email"], webhooks: [] }),
    bucketId
  );
  const deadline = Math.floor(Date.now() / 1000) + 3 * DAY_S;
  const { id: itemId } = db
    .prepare(
      "insert into items (bucket_id, user_id, assignee_id, title, deadline, deadline_timezone) values (?, ?, ?, ?, ?, 'UTC') returning id"
    )
    .get(bucketId, owner, member, title, deadline) as { id: number };
  db.prepare(
    "insert into item_reminders (item_id, user_id, next_reminder_at) values (?, ?, ?)"
  ).run(itemId, member, deadline - 3600);
  db.close();
  return bucketId;
}

test("item info shows the member their own reminder and tells the owner it went to them", async ({
  page,
  browser,
}) => {
  const ownerEmail = uniqueEmail("e2e-remind-owner");
  await login(page, ownerEmail);
  const other = await browser.newContext();
  const member = await other.newPage();
  const memberEmail = uniqueEmail("e2e-remind-member");
  await login(member, memberEmail);
  const title = `water plants ${Date.now()}`;
  const bucketId = seedAssignedItem(ownerEmail, memberEmail, title);

  await member.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(member, title)).toBeVisible();
  const memberDetails = await openReminderDetails(member, title);
  await expect(memberDetails).toContainText(/next \w{3} \d+/);

  await page.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(page, title)).toBeVisible();
  const ownerDetails = await openReminderDetails(page, title);
  await expect(ownerDetails).toContainText("no reminders for you — it's assigned to someone else");
  await expect(ownerDetails).toContainText(/also reminded\w+ · next \w{3} \d+/);
  await other.close();
});
