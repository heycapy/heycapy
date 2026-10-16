import { test, expect, type Locator, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { addItem, itemRow } from "../helpers/buckets";
import { login, uniqueEmail } from "../helpers/login";
import {
  closeDialog,
  expectSelected,
  field,
  modal,
  openSettings as openSettingsDialog,
  option,
  saveSettings,
  switchTab,
} from "../helpers/settings";

const bracket = (label: string) => new RegExp(`^\\[\\s*${label}\\s*\\]$`);

function addBucket(email: string, name: string): number {
  const db = new Database(E2E_DATABASE_FILE);
  const { id: userId } = db.prepare("select id from users where email = ?").get(email) as {
    id: number;
  };
  const { id } = db
    .prepare("insert into buckets (user_id, name) values (?, ?) returning id")
    .get(userId, name) as { id: number };
  db.close();
  return id;
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: bracket("settings") }).click();
}

async function openMembers(page: Page) {
  await openSettings(page);
  await page.getByRole("button", { name: "members", exact: true }).click();
}

async function ownerWithInvite(page: Page, bucketName: string) {
  const email = uniqueEmail("e2e-share-owner");
  await login(page, email);
  const bucketId = addBucket(email, bucketName);
  await page.goto(`/?bucket=${bucketId}`);
  await openMembers(page);
  await page.getByRole("button", { name: bracket("create invite") }).click();
  const code = (await page.getByTestId("invite-code").textContent()) ?? "";
  return { bucketId, code };
}

async function joinWithCode(page: Page, code: string, displayName?: string): Promise<string> {
  const email = uniqueEmail("e2e-share-friend");
  await login(page, email);
  if (displayName) {
    const db = new Database(E2E_DATABASE_FILE);
    db.prepare("update users set display_name = ? where email = ?").run(displayName, email);
    db.close();
  }
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "join a bucket" }).click();
  await page.getByRole("textbox", { name: "invite code" }).fill(code.toLowerCase());
  await page.getByRole("button", { name: bracket("join") }).click();
  return email;
}

test("an owner invites with a code, the friend joins from the menu and sees who is in", async ({
  page,
  browser,
}) => {
  const bucketName = `shared ${Date.now()}`;
  const { bucketId, code } = await ownerWithInvite(page, bucketName);
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await expect(page.getByRole("textbox", { name: "invite link" })).toHaveValue(
    new RegExp(`/join/${code.replace("-", "")}$`)
  );
  await expect(page.getByRole("img", { name: "scan to join this bucket" })).toBeVisible();
  await expect(page.getByText("people in this bucket (1/5)")).toBeVisible();

  const friend = await browser.newPage();
  await joinWithCode(friend, code);
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await expect(friend.getByText(bucketName).first()).toBeVisible();
  const itemTitle = `added by a member ${Date.now()}`;
  await addItem(friend, itemTitle);

  await openMembers(friend);
  await expect(friend.getByText("people in this bucket (2/5)")).toBeVisible();
  await expect(friend.getByRole("button", { name: bracket("leave bucket") })).toBeVisible();
  await expect(friend.getByRole("button", { name: bracket("create invite") })).toHaveCount(0);
  await expect(friend.getByRole("button", { name: "advanced", exact: true })).toHaveCount(0);
  await expect(friend.getByRole("textbox", { name: "name" })).toHaveCount(0);

  await page.reload();
  await expect(itemRow(page, itemTitle)).toBeVisible();
  await openMembers(page);
  await expect(page.getByText("people in this bucket (2/5)")).toBeVisible();
  await page.getByRole("button", { name: bracket("remove") }).click();
  await page.getByRole("button", { name: bracket("confirm") }).click();
  await expect(page.getByText("people in this bucket (1/5)")).toBeVisible();

  await friend.reload();
  await expect(friend.getByText("no buckets yet.")).toBeVisible();
  await friend.close();
});

test("a member can leave a bucket", async ({ page, browser }) => {
  const { code } = await ownerWithInvite(page, `leave ${Date.now()}`);

  const friend = await browser.newPage();
  await joinWithCode(friend, code);
  await friend.waitForURL(/\/\?bucket=\d+$/);
  await openMembers(friend);
  await friend.getByRole("button", { name: bracket("leave bucket") }).click();
  await friend.getByRole("button", { name: bracket("confirm") }).click();

  await expect(friend.getByText("no buckets yet.")).toBeVisible();
  await page.reload();
  await openMembers(page);
  await expect(page.getByText("people in this bucket (1/5)")).toBeVisible();
  await friend.close();
});

function channelsOf(bucketId: number, owner: boolean): string {
  const db = new Database(E2E_DATABASE_FILE);
  const { channels } = db
    .prepare("select channels from bucket_members where bucket_id = ? and role = ?")
    .get(bucketId, owner ? "owner" : "member") as { channels: string };
  db.close();
  return channels;
}

test("a member sees the bucket's rules and changes only where their own reminders go", async ({
  page,
  browser,
}) => {
  const { bucketId, code } = await ownerWithInvite(page, `channels ${Date.now()}`);
  const ownerChannels = channelsOf(bucketId, true);

  const friend = await browser.newPage();
  await joinWithCode(friend, code);
  await friend.waitForURL(`/?bucket=${bucketId}`);
  const dialog = await openSettingsDialog(friend);
  await expect(dialog.getByRole("note")).toContainText("view only");
  await expect(dialog.getByRole("group", { name: "set by the owner" })).toBeVisible();
  await expect(field(dialog, "sort by").getByRole("button").first()).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "[ save ]", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "advanced", exact: true })).toHaveCount(0);

  await switchTab(dialog, "notifications");
  await expect(field(dialog, "remind at").getByRole("textbox")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: bracket("configure telegram") })).toHaveCount(0);
  const channels = field(dialog, "channels");
  await expect(channels).toContainText("where your reminders from this bucket go");
  // Joining starts them on the channels that work for them
  await expectSelected(option(channels, "email"));
  await expectSelected(option(channels, "telegram"), false);
  await option(channels, "telegram").click();
  await saveSettings(dialog);

  const reopened = await openSettingsDialog(friend);
  await switchTab(reopened, "notifications");
  await expectSelected(option(field(reopened, "channels"), "telegram"));
  await closeDialog(reopened);
  expect(JSON.parse(channelsOf(bucketId, false))).toMatchObject({ medium: ["email", "telegram"] });
  expect(channelsOf(bucketId, true)).toBe(ownerChannels);
  await friend.close();
});

test("an owner can cancel an invite before it is used", async ({ page, browser }) => {
  const { code } = await ownerWithInvite(page, `cancel ${Date.now()}`);
  await page.getByRole("button", { name: bracket("cancel") }).click();
  await expect(page.getByText(/expires in/)).toHaveCount(0);

  const friend = await browser.newPage();
  await joinWithCode(friend, code);
  await expect(
    friend.getByRole("alert").filter({ hasText: "That code isn't valid or has expired." })
  ).toBeVisible();
  await friend.close();
});

async function deleteItem(page: Page, title: string) {
  await itemRow(page, title).click();
  const dialog = modal(page, /^edit item$/);
  await dialog.getByRole("button", { name: "delete item" }).click();
  await expect(itemRow(page, title)).toHaveCount(0);
}

async function openTrash(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "trash", exact: true }).click();
  const sheet = page.locator("aside").filter({ has: page.getByText("trash", { exact: true }) });
  await expect(sheet.getByText("loading...")).not.toBeVisible();
  return sheet;
}

function trashedItem(sheet: Locator, title: string): Locator {
  return sheet
    .getByRole("region", { name: "items" })
    .locator("div.flex.items-center")
    .filter({ has: sheet.page().getByText(title, { exact: true }) });
}

test("a shared trash: a member can restore, only the owner can delete forever", async ({
  page,
  browser,
}) => {
  const { code } = await ownerWithInvite(page, `trash ${Date.now()}`);
  const friend = await browser.newPage();
  await joinWithCode(friend, code);
  await friend.waitForURL(/\/\?bucket=\d+$/);

  const gone = `old note ${Date.now()}`;
  const back = `call dentist ${Date.now()}`;
  await addItem(friend, gone);
  await addItem(friend, back);
  await deleteItem(friend, gone);
  await deleteItem(friend, back);

  const friendTrash = await openTrash(friend);
  await expect(trashedItem(friendTrash, gone)).toContainText("deleted by you");
  await expect(option(trashedItem(friendTrash, gone), "[ delete ]")).toHaveCount(0);
  await expect(friendTrash.getByRole("button", { name: "empty trash" })).toHaveCount(0);
  await option(trashedItem(friendTrash, back), "[ restore ]").click();
  await expect(trashedItem(friendTrash, back)).toHaveCount(0);

  await page.reload();
  const ownerTrash = await openTrash(page);
  const row = trashedItem(ownerTrash, gone);
  await expect(row).toContainText(/deleted by \S+/);
  await option(row, "[ delete ]").click();
  await option(row, "[ confirm ]").click();
  await expect(row).toHaveCount(0);
  await friend.close();
});

async function openAccountTab(page: Page) {
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "account", exact: true }).click();
}

test("an owner can't delete their account while they still share a bucket", async ({
  page,
  browser,
}) => {
  const bucketName = `delete ${Date.now()}`;
  const { code } = await ownerWithInvite(page, bucketName);
  const friend = await browser.newPage();
  await joinWithCode(friend, code);
  await friend.waitForURL(/\/\?bucket=\d+$/);

  await page.reload();
  await openAccountTab(page);
  await expect(
    page.getByText(`you still own ${bucketName}, shared with other people`)
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /delete account/ })).toBeDisabled();

  await openMembers(friend);
  await friend.getByRole("button", { name: bracket("leave bucket") }).click();
  await friend.getByRole("button", { name: bracket("confirm") }).click();
  await expect(friend.getByText("no buckets yet.")).toBeVisible();

  await page.reload();
  await openAccountTab(page);
  await expect(page.getByText(/you still own/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /delete account/ })).toBeEnabled();
  await friend.close();
});

test("an owner hands the bucket to a member, then can leave it", async ({ page, browser }) => {
  const bucketName = `hand over ${Date.now()}`;
  const { code } = await ownerWithInvite(page, bucketName);
  const friend = await browser.newPage();
  await joinWithCode(friend, code);
  await friend.waitForURL(/\/\?bucket=\d+$/);

  await page.reload();
  await openMembers(page);
  await expect(page.getByText("to leave, make someone else the owner first")).toBeVisible();
  await page.getByRole("button", { name: bracket("make owner") }).click();
  await expect(page.getByText("make them the owner? you stay in as a member")).toBeVisible();
  await page.getByRole("button", { name: bracket("confirm") }).click();

  await expect(page.getByRole("button", { name: bracket("leave bucket") })).toBeVisible();
  await expect(page.getByRole("button", { name: bracket("create invite") })).toHaveCount(0);
  await expect(page.getByRole("button", { name: bracket("make owner") })).toHaveCount(0);

  // The new owner's open page catches up on its own
  await openMembers(friend);
  await expect(friend.getByRole("button", { name: bracket("create invite") })).toBeVisible();
  await expect(friend.getByRole("button", { name: bracket("remove") })).toBeVisible();

  await page.getByRole("button", { name: bracket("leave bucket") }).click();
  await page.getByRole("button", { name: bracket("confirm") }).click();
  await expect(page.getByText(bucketName)).toHaveCount(0);
  await openAccountTab(page);
  await expect(page.getByText(/you still own/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /delete account/ })).toBeEnabled();
  await friend.close();
});

function newItemDialog(page: Page): Locator {
  return page.locator("div.fixed").filter({ has: page.getByText("new item", { exact: true }) });
}

test("an item can be assigned to a member, and a bucket nobody shares has no such field", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("e2e-assign-owner");
  await login(page, email);
  const bucketId = addBucket(email, `assign ${Date.now()}`);
  await page.goto(`/?bucket=${bucketId}`);

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  await expect(newItemDialog(page)).toBeVisible();
  await expect(newItemDialog(page).getByText("assigned to")).toHaveCount(0);
  await newItemDialog(page).getByRole("button", { name: "[ x ]", exact: true }).click();

  await openMembers(page);
  await page.getByRole("button", { name: bracket("create invite") }).click();
  const code = (await page.getByTestId("invite-code").textContent()) ?? "";
  const friend = await browser.newPage();
  await joinWithCode(friend, code, "Sam");
  await friend.waitForURL(`/?bucket=${bucketId}`);

  const title = `take out the bins ${Date.now()}`;
  await page.goto(`/?bucket=${bucketId}`);
  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = newItemDialog(page);
  await dialog.locator("textarea").fill(title);
  await dialog.getByRole("button", { name: "Sam", exact: true }).click();
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, title)).toContainText("→ Sam");

  await friend.reload();
  await expect(itemRow(friend, title)).toContainText("→ you");
  await itemRow(friend, title).click();
  const edit = modal(friend, /^edit item$/);
  await edit.getByRole("button", { name: "anyone", exact: true }).click();
  await edit.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(itemRow(friend, title)).not.toContainText("→");

  await page.reload();
  await expect(itemRow(page, title)).not.toContainText("→");
  await friend.close();
});

test("typing @ in the title picks a member in a shared bucket, and does nothing in a solo one", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("e2e-mention-owner");
  await login(page, email);
  const bucketId = addBucket(email, `mention ${Date.now()}`);
  await page.goto(`/?bucket=${bucketId}`);

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const solo = newItemDialog(page);
  await solo.locator("textarea").fill("@");
  await expect(solo.getByRole("listbox")).toHaveCount(0);
  await solo.locator("textarea").fill("remind @sa about it");
  await expect(solo.getByRole("listbox")).toHaveCount(0);
  await solo.getByRole("button", { name: "[ x ]", exact: true }).click();

  await openMembers(page);
  await page.getByRole("button", { name: bracket("create invite") }).click();
  const code = (await page.getByTestId("invite-code").textContent()) ?? "";
  const friend = await browser.newPage();
  await joinWithCode(friend, code, "Sam");
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await friend.close();

  await page.goto(`/?bucket=${bucketId}`);
  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = newItemDialog(page);
  const title = dialog.locator("textarea");

  await title.fill("mail bob@example.com");
  await expect(dialog.getByRole("listbox")).toHaveCount(0);

  await title.fill("buy oat milk @sa");
  await expect(dialog.getByRole("option", { name: /^Sam/ })).toBeVisible();
  await title.press("Escape");
  await expect(dialog.getByRole("listbox")).toHaveCount(0);
  await expect(title).toHaveValue("buy oat milk @sa");
  await expect(page.getByText("new item", { exact: true })).toBeVisible();

  await title.press("m");
  await expect(dialog.getByRole("option", { name: /^Sam/ })).toBeVisible();
  await title.press("Enter");
  await expect(title).toHaveValue("buy oat milk");
  await expect(dialog.getByRole("button", { name: /^Sam/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, "buy oat milk")).toContainText("→ Sam");

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  await title.fill("water the plants @");
  await expect(dialog.getByRole("option")).toHaveCount(3);
  await title.press("ArrowDown");
  await expect(dialog.getByRole("option", { name: /^Sam/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await dialog.getByRole("option", { name: /^Sam/ }).click();
  await expect(title).toHaveValue("water the plants");
  await expect(dialog.getByRole("button", { name: /^Sam/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("people see each other's avatars next to their names, a generated one if never drawn", async ({
  page,
  browser,
}) => {
  const { bucketId, code } = await ownerWithInvite(page, `avatars ${Date.now()}`);
  const friend = await browser.newPage();
  const friendEmail = await joinWithCode(friend, code, "Sam");
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await friend.close();
  // a full-width red row, the owner never drew, and a generated avatar keeps a margin so has none
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare("update users set avatar = ? where email = ?").run(
    ".".repeat(64) + "8".repeat(16) + ".".repeat(176),
    friendEmail
  );
  db.close();
  const sams = (scope: Locator) => scope.locator('svg:has(rect.fill-avatar-8[width="16"])');

  await page.goto(`/?bucket=${bucketId}`);
  await openMembers(page);
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('svg[width="32"] rect')).not.toHaveCount(0);
  await expect(sams(rows.nth(1))).toHaveAttribute("width", "32");
  await closeDialog(modal(page, /^bucket settings \[/));

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = newItemDialog(page);
  await expect(sams(dialog.getByRole("button", { name: "Sam", exact: true }))).toHaveAttribute(
    "width",
    "16"
  );
  await dialog.locator("textarea").fill("call @sa");
  await expect(sams(page.getByRole("listbox", { name: "assign to" }))).toHaveCount(1);
  await page.keyboard.press("Enter");
  const title = `call ${Date.now()}`;
  await dialog.locator("textarea").fill(title);
  await dialog.getByRole("button", { name: "Sam", exact: true }).click();
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(itemRow(page, title)).toContainText("→ Sam");
  await expect(sams(itemRow(page, title))).toHaveAttribute("width", "16");

  await itemRow(page, title).click();
  await modal(page, /^edit item$/)
    .getByRole("button", { name: "delete item" })
    .click();
  await expect(itemRow(page, title)).toHaveCount(0);
  await page.getByRole("button", { name: "[ ··· ]", exact: true }).click();
  await page.getByRole("button", { name: "trash", exact: true }).click();
  const trashed = page
    .locator("aside")
    .getByRole("region", { name: "items" })
    .locator("div.flex.items-center")
    .filter({ has: page.getByText(title, { exact: true }) });
  await expect(trashed).toContainText("deleted by you");
  await expect(trashed.locator('svg[width="16"] rect')).not.toHaveCount(0);
});
