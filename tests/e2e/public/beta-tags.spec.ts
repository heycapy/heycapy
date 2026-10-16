import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { login, uniqueEmail } from "../helpers/login";

function addBucket(email: string): number {
  const db = new Database(E2E_DATABASE_FILE);
  const { id: userId } = db.prepare("select id from users where email = ?").get(email) as {
    id: number;
  };
  const { id } = db
    .prepare("insert into buckets (user_id, name) values (?, ?) returning id")
    .get(userId, `beta ${Date.now()}`) as { id: number };
  db.close();
  return id;
}

test("sharing is tagged beta wherever it shows, without changing the names", async ({ page }) => {
  const email = uniqueEmail("e2e-beta");
  await login(page, email);
  await page.goto(`/?bucket=${addBucket(email)}`);

  await page.getByRole("button", { name: "···" }).click();
  const joinItem = page.getByRole("button", { name: "join a bucket", exact: true });
  await expect(joinItem).toContainText("[beta]");
  await joinItem.click();
  await expect(page.getByText(/^join a bucket\s*\[beta\]$/)).toBeVisible();
  await page.getByRole("button", { name: "[ x ]", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "invite code" })).toHaveCount(0);

  await page.getByRole("button", { name: /^\[\s*settings\s*\]$/ }).click();
  const membersTag = page.getByRole("button", { name: "members", exact: true }).getByText("[beta]");
  await expect(membersTag).toBeVisible();
  await expect(page.getByRole("button", { name: "items", exact: true })).not.toContainText(
    "[beta]"
  );
  // The tab row only fits the four names on a phone
  await page.setViewportSize({ width: 390, height: 760 });
  await expect(membersTag).toBeHidden();

  await page.goto("/join/ABCD2345");
  await expect(page.getByText("someone invited you to share a bucket")).toContainText("[beta]");
});
