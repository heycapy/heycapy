import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { addItemButton, createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { login, uniqueEmail } from "../helpers/login";
import {
  closeDialog,
  field,
  modal,
  openSettings,
  settingsDialog,
  switchTab,
} from "../helpers/settings";

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
    .get(id(ownerEmail), `family ${Date.now()}`, "{}") as {
    id: number;
  };
  db.prepare("insert into bucket_members (bucket_id, user_id) values (?, ?)").run(
    bucketId,
    id(memberEmail)
  );
  // Everyone in it picked email for their reminders
  db.prepare("update bucket_members set channels = ? where bucket_id = ?").run(
    JSON.stringify({ medium: ["email"], webhooks: [] }),
    bucketId
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
  await closeDialog(settings);

  await addItemButton(page).click();
  const dialog = modal(page, /^new item$/);
  await dialog.locator("textarea").fill("water the plants tomorrow 9am");
  await expect(dialog.getByRole("button", { name: "9 am" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "time on" })).toHaveCount(0);
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

// The deadline as it reads on a clock, from the database
function savedDeadline(title: string): { zone: string; at: (zone: string) => string } {
  const db = new Database(E2E_DATABASE_FILE);
  const row = db
    .prepare("select deadline, deadline_timezone from items where title = ?")
    .get(title) as { deadline: number; deadline_timezone: string };
  db.close();
  return {
    zone: row.deadline_timezone,
    at: (zone) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(row.deadline * 1000)),
  };
}

test("a time for someone on another clock is set on theirs, unless picked by hand", async ({
  page,
  browser,
}) => {
  const ownerEmail = uniqueEmail("e2e-tz-owner");
  await login(page, ownerEmail);
  const london = await browser.newContext({ timezoneId: "Europe/London" });
  const memberEmail = uniqueEmail("e2e-tz-member");
  await login(await london.newPage(), memberEmail);
  await london.close();
  const bucketId = seedSharedBucket(ownerEmail, memberEmail);
  await page.goto(`/?bucket=${bucketId}`);
  await expect(page.getByText("people here are in 2 timezones · India, UK")).toBeVisible();

  const dialog = modal(page, /^new item$/);
  const clocks = dialog.getByRole("group", { name: "time on" });
  const assignTo = (name: RegExp) => dialog.getByRole("button", { name }).click();

  const forSam = `call the bank ${Date.now()}`;
  await addItemButton(page).click();
  await dialog.locator("textarea").fill(`${forSam} tomorrow 9am`);
  await expect(clocks.getByRole("button", { name: "India" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await assignTo(/\sUK( · no reminders set up)?$/);
  await expect(clocks.getByRole("button", { name: "UK" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "9 am" })).toBeVisible();
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, forSam)).toBeVisible();
  const sams = savedDeadline(forSam);
  expect(sams.zone).toBe("Europe/London");
  expect(sams.at("Europe/London")).toBe("09:00");

  const onIndia = `pay the gardener ${Date.now()}`;
  await addItemButton(page).click();
  await dialog.locator("textarea").fill(`${onIndia} tomorrow 9am`);
  await assignTo(/\sUK( · no reminders set up)?$/);
  await clocks.getByRole("button", { name: "India" }).click();
  await assignTo(/^anyone$/);
  await expect(clocks.getByRole("button", { name: "India" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await assignTo(/\sUK( · no reminders set up)?$/);
  await expect(clocks.getByRole("button", { name: "India" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(dialog.getByRole("button", { name: "9 am" })).toBeVisible();
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, onIndia)).toBeVisible();
  const indias = savedDeadline(onIndia);
  expect(indias.zone).toBe("Asia/Kolkata");
  expect(indias.at("Asia/Kolkata")).toBe("09:00");
});

test("the time field shows everyone's time and warns softly about their nights", async ({
  page,
  browser,
}) => {
  const ownerEmail = uniqueEmail("e2e-tz-owner");
  await login(page, ownerEmail);
  const london = await browser.newContext({ timezoneId: "Europe/London" });
  const memberEmail = uniqueEmail("e2e-tz-member");
  await login(await london.newPage(), memberEmail);
  await london.close();
  const bucketId = seedSharedBucket(ownerEmail, memberEmail);
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    "update user_settings set quiet_hours_from = '23:00', quiet_hours_to = '08:00' where user_id = (select id from users where email = ?)"
  ).run(memberEmail);
  db.close();
  await page.goto(`/?bucket=${bucketId}`);
  await expect(page.getByText("people here are in 2 timezones · India, UK")).toBeVisible();

  const dialog = modal(page, /^new item$/);
  const preview = dialog.getByTestId("time-preview");
  const title = `call the bank ${Date.now()}`;
  await addItemButton(page).click();
  await dialog.locator("textarea").fill(`${title} tomorrow 9am`);
  await expect(preview).toHaveText(/^\d{1,2}:30am for \S+ · 9am for you$/);
  await expect(dialog.getByRole("status")).toHaveText(
    /^⚠ at night for (\S+) · \1's quiet hours hold the reminder until after it's due$/
  );

  await dialog.getByRole("button", { name: /\sUK( · no reminders set up)?$/ }).click();
  await expect(preview).toHaveText(/^9am for \S+ · \d{1,2}:30pm for you$/);
  await expect(dialog.getByRole("status")).toHaveCount(0);

  await dialog
    .getByRole("group", { name: "time on" })
    .getByRole("button", { name: "India" })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(/quiet hours hold the reminder/);
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, title)).toBeVisible();
});
