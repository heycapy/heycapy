import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { login, uniqueEmail } from "../helpers/login";

function addBuckets(
  email: string,
  rows: { name: string; archived?: boolean; deleted?: boolean }[]
) {
  const db = new Database(E2E_DATABASE_FILE);
  const { id } = db.prepare("select id from users where email = ?").get(email) as { id: number };
  const now = Math.floor(Date.now() / 1000);
  for (const row of rows) {
    db.prepare(
      "insert into buckets (user_id, name, archived_at, deleted_at) values (?, ?, ?, ?)"
    ).run(id, row.name, row.archived ? now : null, row.deleted ? now : null);
  }
  db.close();
}

test("a new user sees one way to start and nothing to restore", async ({ page }) => {
  await login(page, uniqueEmail("e2e-empty"));

  await expect(page.getByText("no buckets yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "[ archived ]" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "[ trash ]" })).toHaveCount(0);

  await page.getByRole("button", { name: "[ new bucket ]" }).click();
  await expect(page.getByText("Pick a template to get started.")).toBeVisible();
});

test("after archiving or deleting every bucket, the way back is offered", async ({ page }) => {
  const email = uniqueEmail("e2e-empty-restore");
  await login(page, email);
  addBuckets(email, [
    { name: "old bills", archived: true },
    { name: "old work", deleted: true },
  ]);
  await page.reload();

  await expect(page.getByText("no buckets yet.")).toBeVisible();
  await page.getByRole("button", { name: "[ archived ]" }).click();
  await expect(page.getByText("old bills")).toBeVisible();
  await page.getByRole("complementary").getByRole("button", { name: "[ x ]" }).click();

  await page.getByRole("button", { name: "[ trash ]" }).click();
  await expect(page.getByText("old work")).toBeVisible();
  await page.getByRole("complementary").getByRole("button", { name: "[ x ]" }).click();

  // bringing one back leaves the empty page for the buckets
  await page.getByRole("button", { name: "[ archived ]" }).click();
  await page
    .getByRole("complementary")
    .getByRole("button", { name: /restore/ })
    .click();
  await expect(page.getByText("no buckets yet.")).toBeHidden();
  await expect(page.getByRole("button", { name: /old bills/ }).first()).toBeVisible();
});
