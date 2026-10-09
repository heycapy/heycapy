import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { enterCode, login, readDevCode, uniqueEmail } from "../helpers/login";

function randomCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "A");
}

// An owner with one bucket and an open invite, set up straight in the database
function sharedBucketWithInvite(code: string, bucketName: string): number {
  const db = new Database(E2E_DATABASE_FILE);
  const now = Math.floor(Date.now() / 1000);
  const { id: ownerId } = db
    .prepare("insert into users (email) values (?) returning id")
    .get(uniqueEmail("e2e-join-owner")) as { id: number };
  db.prepare("insert into user_settings (user_id) values (?)").run(ownerId);
  const { id: bucketId } = db
    .prepare("insert into buckets (user_id, name) values (?, ?) returning id")
    .get(ownerId, bucketName) as { id: number };
  db.prepare(
    "insert into bucket_invites (bucket_id, created_by, code_hash, expires_at) values (?, ?, ?, ?)"
  ).run(bucketId, ownerId, createHash("sha256").update(code).digest("hex"), now + 3600);
  db.close();
  return bucketId;
}

test("an invite link works after signing in, and only once", async ({ page, browser, request }) => {
  const code = randomCode();
  const bucketName = `shared ${code}`;
  const bucketId = sharedBucketWithInvite(code, bucketName);

  await request.get(`/join/${code}`);

  await page.goto(`/join/${code}`);
  await expect(page.getByText("someone invited you to share a bucket")).toBeVisible();
  await page.getByRole("link", { name: "[sign in to join]" }).click();
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  await page.getByPlaceholder("you@example.com").fill(uniqueEmail("e2e-join-friend"));
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await enterCode(page, await readDevCode(page));
  await page.waitForURL(`/join/${code}`);

  await page.getByRole("button", { name: "[ join ]" }).click();
  await page.waitForURL(`/?bucket=${bucketId}`);
  await expect(page.getByText(bucketName).first()).toBeVisible();

  const other = await browser.newPage();
  await login(other, uniqueEmail("e2e-join-late"));
  await other.goto(`/join/${code}`);
  await other.getByRole("button", { name: "[ join ]" }).click();
  await expect(
    other.getByRole("alert").filter({ hasText: "That code isn't valid or has expired." })
  ).toBeVisible();
  await other.close();
});

test("a code that doesn't exist says so", async ({ page }) => {
  await login(page, uniqueEmail("e2e-join-wrong"));

  await page.goto("/join/NOSUCHCODE");
  await page.getByRole("button", { name: "[ join ]" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "That code isn't valid or has expired." })
  ).toBeVisible();
});

test("login only returns to a join page, never to another address", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fjoin%2FABC");
  await page.getByPlaceholder("you@example.com").fill(uniqueEmail("e2e-join-next"));
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await enterCode(page, await readDevCode(page));

  await page.waitForURL("/");
});
