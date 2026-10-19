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
  // Counting the outsider's POSTs can't tell a refresh from the page's own load actions
  await outsider.addInitScript(() => {
    const seen = { open: false, refreshes: 0 };
    Object.assign(window, { liveEvents: seen });
    const Native = window.EventSource;
    window.EventSource = class extends Native {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        this.addEventListener("open", () => (seen.open = true));
        this.addEventListener("message", (e) => {
          if (e.data === "refresh") seen.refreshes++;
        });
      }
    };
  });
  await login(outsider, uniqueEmail("e2e-live-outsider"));
  const bucketId = shareBucket(ownerEmail, null);
  await page.goto(`/?bucket=${bucketId}`);
  const liveEvents = () =>
    outsider.evaluate(
      () => (window as unknown as { liveEvents: { open: boolean; refreshes: number } }).liveEvents
    );
  await expect.poll(async () => (await liveEvents()).open).toBe(true);

  await addItem(page, `pay rent ${Date.now()}`);

  await page.waitForTimeout(1500);
  expect((await liveEvents()).refreshes).toBe(0);
  await other.close();
});
