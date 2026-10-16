import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { addItem, itemRow } from "../helpers/buckets";
import { login, uniqueEmail } from "../helpers/login";

function shareBucket(ownerEmail: string, memberEmail: string | null): number {
  const db = new Database(E2E_DATABASE_FILE);
  const id = (email: string) =>
    (db.prepare("select id from users where email = ?").get(email) as { id: number }).id;
  const { id: bucketId } = db
    .prepare("insert into buckets (user_id, name) values (?, ?) returning id")
    .get(id(ownerEmail), `family ${Date.now()}`) as { id: number };
  if (memberEmail) {
    db.prepare("insert into bucket_members (bucket_id, user_id) values (?, ?)").run(
      bucketId,
      id(memberEmail)
    );
  }
  db.close();
  return bucketId;
}

test("what one member adds shows up on the others' open screens", async ({ page, browser }) => {
  const ownerEmail = uniqueEmail("e2e-live-owner");
  await login(page, ownerEmail);
  const other = await browser.newContext();
  const member = await other.newPage();
  const memberEmail = uniqueEmail("e2e-live-member");
  await login(member, memberEmail);
  const bucketId = shareBucket(ownerEmail, memberEmail);
  await page.goto(`/?bucket=${bucketId}`);
  await member.goto(`/?bucket=${bucketId}`);

  const title = `buy milk ${Date.now()}`;
  await addItem(member, title);

  await expect(itemRow(page, title)).toBeVisible();
  await other.close();
});

test("someone outside the bucket isn't told about it", async ({ page, browser }) => {
  const ownerEmail = uniqueEmail("e2e-live-owner");
  await login(page, ownerEmail);
  const other = await browser.newContext();
  const outsider = await other.newPage();
  await login(outsider, uniqueEmail("e2e-live-outsider"));
  const bucketId = shareBucket(ownerEmail, null);
  await page.goto(`/?bucket=${bucketId}`);
  // A refresh re-fetches the open view through a server action (a POST)
  const refreshes: string[] = [];
  outsider.on("request", (r) => {
    if (r.method() === "POST") refreshes.push(r.url());
  });

  await addItem(page, `pay rent ${Date.now()}`);

  await page.waitForTimeout(1500);
  expect(refreshes).toEqual([]);
  await other.close();
});
