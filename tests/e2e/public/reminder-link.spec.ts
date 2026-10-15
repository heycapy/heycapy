import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE, E2E_JWT_SECRET } from "../helpers/env";
import { uniqueEmail } from "../helpers/login";
import { signReminderAction } from "@/lib/reminders/action-token";

test("an email reminder link opens without logging in and refuses a bad token", async ({
  page,
}) => {
  const res = await page.goto("/r/not.a-real-token");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/r\/not\.a-real-token$/);
  await expect(page.getByText("this link has expired — open heycapy instead")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

function seedUser(db: Database.Database, prefix: string): number {
  return (
    db.prepare("insert into users (email) values (?) returning id").get(uniqueEmail(prefix)) as {
      id: number;
    }
  ).id;
}

// The owner's item in a bucket shared with the member, who is reminded about it too
function seedSharedItem(title: string) {
  const db = new Database(E2E_DATABASE_FILE);
  const owner = seedUser(db, "e2e-link-owner");
  const member = seedUser(db, "e2e-link-member");
  const stranger = seedUser(db, "e2e-link-stranger");
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
  const deadline = Math.floor(Date.now() / 1000) + 86_400;
  const { id: itemId } = db
    .prepare(
      "insert into items (bucket_id, user_id, title, deadline, deadline_timezone) values (?, ?, ?, ?, 'UTC') returning id"
    )
    .get(bucketId, owner, title, deadline) as { id: number };
  db.close();
  return { member, stranger, itemId, deadline };
}

function doneLink(userId: number, itemId: number, deadline: number): string {
  process.env.JWT_SECRET = E2E_JWT_SECRET;
  const token = signReminderAction({
    userId,
    itemId,
    action: "done",
    channel: "email",
    deadline: deadline * 1000,
  });
  return `/r/${token}`;
}

function statusOf(itemId: number): string {
  const db = new Database(E2E_DATABASE_FILE, { readonly: true });
  const row = db.prepare("select status from items where id = ?").get(itemId) as {
    status: string;
  };
  db.close();
  return row.status;
}

test("a member marks someone else's item done from their reminder email", async ({ page }) => {
  const title = `book flights ${Date.now()}`;
  const { member, itemId, deadline } = seedSharedItem(title);

  await page.goto(doneLink(member, itemId, deadline));
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: "[ mark done ]" }).click();
  await expect(page.getByRole("status").filter({ hasText: title })).toHaveText(`✓ "${title}" done`);
  expect(statusOf(itemId)).toBe("completed");
});

test("someone outside the bucket can't open its item from a link", async ({ page }) => {
  const title = `book trains ${Date.now()}`;
  const { stranger, itemId, deadline } = seedSharedItem(title);

  await page.goto(doneLink(stranger, itemId, deadline));
  await expect(page.getByText("this item no longer exists")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  expect(statusOf(itemId)).toBe("active");
});
