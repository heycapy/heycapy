import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { CHANGELOG_URL, LATEST_RELEASE, RELEASES } from "@/lib/whats-new/constants";

test.use({ storageState: authState("whats-new") });
test.describe.configure({ mode: "serial" });

function lastSeenRelease(release: string | null) {
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare("update users set last_seen_release = ? where email = ?").run(
    release,
    specUserEmail("whats-new")
  );
  db.close();
}

function menuItem(page: Page) {
  return page.getByRole("button", { name: /^what's new/ });
}

test("someone from before the update sees a dot until they open what's new", async ({ page }) => {
  lastSeenRelease("0.3.0");
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await expect(menuItem(page)).toHaveAccessibleName("what's new (new)");

  await menuItem(page).click();
  const dialog = page.getByRole("dialog", { name: "what's new" });
  const latest = dialog.getByRole("region", { name: LATEST_RELEASE });
  for (const note of RELEASES[0].notes) {
    await expect(latest.getByRole("heading", { name: note.title })).toBeVisible();
  }
  await expect(dialog.getByRole("link", { name: "full changelog" })).toHaveAttribute(
    "href",
    CHANGELOG_URL
  );
  await dialog.getByRole("button", { name: "[ x ]" }).click();
  await expect(dialog).not.toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "···" }).click();
  await expect(menuItem(page)).toHaveAccessibleName("what's new");
});

test("a new account has nothing unseen", async ({ page }) => {
  lastSeenRelease(LATEST_RELEASE);
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await expect(menuItem(page)).toHaveAccessibleName("what's new");
});
