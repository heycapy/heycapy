import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { login, uniqueEmail } from "../helpers/login";
import { field, modal, openSettings, settingsDialog, switchTab } from "../helpers/settings";

test.use({ timezoneId: "Asia/Kolkata" });

// A bucket the India owner shares with a member in London
function seedSharedBucket(ownerEmail: string, memberEmail: string, title?: string): number {
  const db = new Database(E2E_DATABASE_FILE);
  const id = (email: string) =>
    (db.prepare("select id from users where email = ?").get(email) as { id: number }).id;
  const setZone = db.prepare("update user_settings set timezone = ? where user_id = ?");
  setZone.run("Asia/Kolkata", id(ownerEmail));
  setZone.run("Europe/London", id(memberEmail));
  const { id: bucketId } = db
    .prepare(
      "insert into buckets (user_id, name, notifications_rules) values (?, ?, ?) returning id"
    )
    .get(id(ownerEmail), `family ${Date.now()}`, JSON.stringify({ medium: ["email"] })) as {
    id: number;
  };
  db.prepare("insert into bucket_members (bucket_id, user_id) values (?, ?)").run(
    bucketId,
    id(memberEmail)
  );
  if (title) {
    // Set in India for 09:00 UTC in three days, and assigned to the member, who has no email
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    db.prepare(
      "insert into items (bucket_id, user_id, assignee_id, title, deadline, deadline_timezone) values (?, ?, ?, ?, ?, 'Asia/Kolkata')"
    ).run(bucketId, id(ownerEmail), id(memberEmail), title, Date.parse(`${day}T09:00:00Z`) / 1000);
    db.prepare("update user_settings set notifications_email = 0 where user_id = ?").run(
      id(memberEmail)
    );
  }
  db.close();
  return bucketId;
}

test("a bucket shared across timezones says where everyone is", async ({ page, browser }) => {
  const ownerEmail = uniqueEmail("e2e-tz-owner");
  await login(page, ownerEmail);
  const london = await browser.newContext({ timezoneId: "Europe/London" });
  const memberEmail = uniqueEmail("e2e-tz-member");
  await login(await london.newPage(), memberEmail);
  await london.close();
  const bucketId = seedSharedBucket(ownerEmail, memberEmail);

  await page.goto(`/?bucket=${bucketId}`);
  await expect(page.getByText("people here are in 2 timezones · India, UK")).toBeVisible();

  await page.getByRole("button", { name: /^\[\s*settings\s*\]$/ }).click();
  await page.getByRole("button", { name: "members", exact: true }).click();
  const rows = page.getByRole("listitem");
  await expect(rows.nth(0)).toContainText("ownerIndia");
  await expect(rows.nth(1)).toContainText(
    /memberUK · \d{1,2}(:\d\d)?(am|pm) now · \d:\d\d h behind you\[/
  );

  await page.getByRole("button", { name: "notifications", exact: true }).click();
  await expect(field(settingsDialog(page), "remind at")).toContainText(
    "each person gets this on their own clock"
  );
});

test("a bucket on one clock doesn't mention clocks in its rules", async ({ page }) => {
  await login(page, uniqueEmail("e2e-tz-solo"));
  await createAndSelectBucket(page, uniqueName("solo"));
  const settings = await openSettings(page);
  await switchTab(settings, "notifications");
  const remindAt = field(settings, "remind at");
  await expect(remindAt).toContainText("the time of day for items without a time");
  await expect(remindAt).not.toContainText("each person gets this on their own clock");
});

test("a timed item shows the time on the other clock that matters", async ({ page, browser }) => {
  const ownerEmail = uniqueEmail("e2e-tz-owner");
  await login(page, ownerEmail);
  const london = await browser.newContext({ timezoneId: "Europe/London" });
  const member = await london.newPage();
  const memberEmail = uniqueEmail("e2e-tz-member");
  await login(member, memberEmail);
  const title = `call the bank ${Date.now()}`;
  const bucketId = seedSharedBucket(ownerEmail, memberEmail, title);

  await page.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(page, title)).toContainText(/\(\d{1,2}(am|pm) for \w+\)/);
  await member.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(member, title)).toContainText(/\(\d{1,2}:30pm India\)/);

  await itemRow(page, title).click();
  const picker = modal(page, /^edit item$/);
  await expect(picker.getByRole("button", { name: /\(you\)\s*India$/ })).toBeVisible();
  await expect(picker.getByRole("button", { name: /\sUK · no reminders set up$/ })).toBeVisible();
  await london.close();
});
