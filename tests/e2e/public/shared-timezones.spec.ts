import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { login, uniqueEmail } from "../helpers/login";

test.use({ timezoneId: "Asia/Kolkata" });

// A bucket the India owner shares with a member in London
function seedSharedBucket(ownerEmail: string, memberEmail: string): number {
  const db = new Database(E2E_DATABASE_FILE);
  const id = (email: string) =>
    (db.prepare("select id from users where email = ?").get(email) as { id: number }).id;
  const setZone = db.prepare("update user_settings set timezone = ? where user_id = ?");
  setZone.run("Asia/Kolkata", id(ownerEmail));
  setZone.run("Europe/London", id(memberEmail));
  const { id: bucketId } = db
    .prepare("insert into buckets (user_id, name) values (?, ?) returning id")
    .get(id(ownerEmail), `family ${Date.now()}`) as { id: number };
  db.prepare("insert into bucket_members (bucket_id, user_id) values (?, ?)").run(
    bucketId,
    id(memberEmail)
  );
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
});
