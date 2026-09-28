import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal } from "../helpers/settings";
import { daysFromNow, enableWebhook, postItem } from "../helpers/webhook";
import { E2E_DATABASE_FILE, E2E_JWT_SECRET } from "../helpers/env";
import { signReminderAction } from "@/lib/reminders/action-token";

test.use({ storageState: authState("remind-again") });

function emailLink(itemId: number): string {
  const db = new Database(E2E_DATABASE_FILE, { readonly: true });
  const row = db.prepare("select user_id, deadline from items where id = ?").get(itemId) as {
    user_id: number;
    deadline: number;
  };
  db.close();
  process.env.JWT_SECRET = E2E_JWT_SECRET;
  const token = signReminderAction({
    userId: row.user_id,
    itemId,
    action: "15",
    channel: "email",
    deadline: row.deadline * 1000,
  });
  return `/r/${token}`;
}

async function addDatedItem(page: Page, title: string): Promise<number> {
  const webhook = await enableWebhook(page);
  const res = await postItem(page.request, webhook, { title, deadline: daysFromNow(2) });
  expect(res.status()).toBe(201);
  await expect(itemRow(page, title)).toBeVisible();
  return ((await res.json()) as { id: number }).id;
}

test("remind again from an email shows on the item and in its history, and can be cancelled", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Remind Again"));
  const title = uniqueName("pay rent");
  const itemId = await addDatedItem(page, title);

  await page.goto(emailLink(itemId));
  await page.getByRole("button", { name: "[ remind me again in 15 min ]" }).click();
  await expect(page.getByRole("status")).toContainText(`"${title}" — I'll remind you again`);

  await page.goto("/");
  await expect(itemRow(page, title)).toContainText(/⏰ again \w{3} \d+/);

  await page.getByRole("button", { name: /^reminder / }).click();
  const dialog = modal(page, new RegExp(`^reminder \\[${title}\\]$`));
  const details = dialog.getByRole("region", { name: "reminders" });
  await expect(details).toContainText("asked from email");
  await expect(details).toContainText(/you: remind again at \w{3} \d+.* \(from email\)/);

  await details.getByRole("button", { name: "[ cancel ]" }).click();
  await expect(details).not.toContainText("reminding again");
  await expect(details).toContainText(/next \w{3} \d+/);
  await expect(details).toContainText("you: cancelled remind again (from app)");
  await dialog.getByRole("button", { name: "[ x ]", exact: true }).click();
  await expect(itemRow(page, title)).not.toContainText("⏰ again");
});
