import { test, expect, type Locator, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import {
  assignOnly,
  addItem,
  detailChip,
  editForm,
  itemRow,
  newItemForm,
  openDetail,
  openItemMenu,
} from "../helpers/buckets";
import { login, uniqueEmail, uniqueUsername } from "../helpers/login";
import { giveOwnSmtp } from "../helpers/email";
import {
  closeDialog,
  expectSelected,
  field,
  openSettings as openSettingsDialog,
  option,
  saveSettings,
  settingsDialog,
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
  await page.getByRole("button", { name: "bucket settings", exact: true }).click();
}

async function openMembers(page: Page) {
  await openSettings(page);
  await page.getByRole("button", { name: "members", exact: true }).click();
}

async function ownerWithInvite(page: Page, bucketName: string) {
  const email = uniqueEmail("e2e-share-owner");
  await login(page, email);
  giveOwnSmtp(email);
  const bucketId = addBucket(email, bucketName);
  await page.goto(`/?bucket=${bucketId}`);
  await openMembers(page);
  await page.getByRole("button", { name: bracket("create invite") }).click();
  const code = (await page.getByTestId("invite-code").textContent()) ?? "";
  return { bucketId, code, email };
}

async function joinWithCode(page: Page, code: string, username?: string): Promise<string> {
  const email = uniqueEmail("e2e-share-friend");
  await login(page, email);
  giveOwnSmtp(email);
  if (username) {
    const db = new Database(E2E_DATABASE_FILE);
    db.prepare("update users set username = ? where email = ?").run(username, email);
    db.close();
  }
  await page.getByRole("button", { name: "your menu", exact: true }).click();
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
  const dialog = editForm(page);
  await dialog.getByRole("button", { name: "delete item" }).click();
  await expect(itemRow(page, title)).toHaveCount(0);
}

async function openTrash(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "trash", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "trash" });
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
  await page.getByRole("button", { name: "your menu", exact: true }).click();
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

test("an item can be assigned to a member, and a bucket nobody shares has no such field", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("e2e-assign-owner");
  await login(page, email);
  const bucketId = addBucket(email, `assign ${Date.now()}`);
  await page.goto(`/?bucket=${bucketId}`);

  await page.getByRole("button", { name: "add with details", exact: true }).click();
  await expect(newItemForm(page)).toBeVisible();
  await expect(newItemForm(page).getByText("assigned to")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await openMembers(page);
  await page.getByRole("button", { name: bracket("create invite") }).click();
  const code = (await page.getByTestId("invite-code").textContent()) ?? "";
  const friend = await browser.newPage();
  const sam = uniqueUsername("sam");
  await joinWithCode(friend, code, sam);
  await friend.waitForURL(`/?bucket=${bucketId}`);

  const title = `take out the bins ${Date.now()}`;
  await page.goto(`/?bucket=${bucketId}`);
  await page.getByRole("button", { name: "add with details", exact: true }).click();
  const dialog = newItemForm(page);
  await dialog.locator("textarea").fill(title);
  await expect(detailChip(dialog, "assignee")).toHaveAccessibleName("assignee");
  await assignOnly(dialog, sam);
  await expect(detailChip(dialog, "assignee")).toHaveAccessibleName(`assignee: ${sam}`);
  await dialog.getByRole("button", { name: "add", exact: true }).click();
  await expect(itemRow(page, title)).toContainText(sam);

  const fromBox = `water the plants ${Date.now()}`;
  const box = page.getByRole("textbox", { name: /^add to / });
  await box.fill(`${fromBox} @${sam}`);
  await page.getByRole("listbox", { name: "assign to" }).getByRole("option", { name: sam }).click();
  await expect(box).toHaveValue(fromBox);
  await expect(page.getByTestId("quick-add-hint")).toHaveText(`@${sam}`);
  await box.press("Enter");
  await expect(itemRow(page, fromBox)).toContainText(sam);

  await friend.reload();
  await expect(itemRow(friend, title)).toContainText("you");
  await itemRow(friend, title).click();
  const edit = editForm(friend);
  await assignOnly(edit, null);
  await expect(detailChip(edit, "assignee")).toHaveAccessibleName("assignee");
  await edit.getByRole("button", { name: "update", exact: true }).click();
  await expect(edit).not.toBeVisible();

  await page.reload();
  await expect(itemRow(page, title)).toContainText("you");
  await expect(itemRow(page, title)).toContainText(sam);
  await friend.close();
});

test("a new item is for everyone unless narrowed, and can be for no one", async ({
  page,
  browser,
}) => {
  const { bucketId, code } = await ownerWithInvite(page, `for whom ${Date.now()}`);
  const friend = await browser.newPage();
  const sam = uniqueUsername("sam");
  await joinWithCode(friend, code, sam);
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await friend.close();

  const stamp = Date.now();
  const forAll = `sweep the hall ${stamp}`;
  await page.goto(`/?bucket=${bucketId}`);
  await addItem(page, forAll);
  await expect(itemRow(page, forAll)).toContainText(`you, ${sam}`);

  const forNobody = `think about holidays ${stamp}`;
  await page.getByRole("button", { name: "add with details", exact: true }).click();
  const dialog = newItemForm(page);
  await dialog.locator("textarea").fill(forNobody);
  await openDetail(dialog, "assignee");
  const people = dialog.getByText("assigned to", { exact: true }).locator("..");
  await people.getByRole("button", { name: sam, exact: true }).click();
  await people.getByRole("button", { name: /\(you\)/ }).click();
  await expect(dialog.getByText("no one is reminded about this one")).toBeVisible();
  await expect(detailChip(dialog, "assignee")).toHaveAccessibleName("assignee: no one");
  await dialog.getByRole("button", { name: "add", exact: true }).click();
  await expect(itemRow(page, forNobody)).toContainText("no one");
});

function addDueItem(bucketId: number, email: string, title: string, ...assigneeEmails: string[]) {
  const db = new Database(E2E_DATABASE_FILE);
  const { id } = db
    .prepare(
      "insert into items (bucket_id, user_id, title, deadline) values (?, (select id from users where email = ?), ?, unixepoch()) returning id"
    )
    .get(bucketId, email, title) as { id: number };
  for (const assigneeEmail of assigneeEmails) {
    db.prepare(
      "insert into item_assignees (item_id, user_id) values (?, (select id from users where email = ?))"
    ).run(id, assigneeEmail);
  }
  db.close();
}

test("a shared item's assignees can be changed when it's edited from today or search", async ({
  page,
  browser,
}) => {
  const { bucketId, code } = await ownerWithInvite(page, `assign elsewhere ${Date.now()}`);
  const friend = await browser.newPage();
  const sam = uniqueUsername("sam");
  const friendEmail = await joinWithCode(friend, code, sam);
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await friend.close();
  const title = `water the plants ${Date.now()}`;
  addDueItem(bucketId, friendEmail, title);

  await page.goto("/");
  await page.getByRole("button", { name: "today", exact: true }).click();
  await itemRow(page, title).click();
  const fromToday = editForm(page);
  await assignOnly(fromToday, sam);
  await fromToday.getByRole("button", { name: "update", exact: true }).click();
  await expect(fromToday).not.toBeVisible();

  await page.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(page, title)).toContainText(sam);

  await page.getByRole("button", { name: "today", exact: true }).click();
  await page.getByRole("button", { name: "search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "search" });
  await search.getByRole("textbox", { name: "search all items" }).fill(title);
  await search.getByRole("button", { name: title }).click();
  const fromSearch = editForm(page);
  await assignOnly(fromSearch, null);
  await fromSearch.getByRole("button", { name: "update", exact: true }).click();
  await expect(fromSearch).not.toBeVisible();

  await page.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(page, title)).toContainText("you");
  await expect(itemRow(page, title)).toContainText(sam);
});

test("today and search show who a shared item is for, like the bucket does", async ({
  page,
  browser,
}) => {
  const {
    bucketId,
    code,
    email: ownerEmail,
  } = await ownerWithInvite(page, `who is it for ${Date.now()}`);
  const friend = await browser.newPage();
  const sam = uniqueUsername("sam");
  const friendEmail = await joinWithCode(friend, code, sam);
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await friend.close();
  const stamp = Date.now();
  const forSam = `water the plants ${stamp}`;
  const forMe = `book the vet ${stamp}`;
  const forBoth = `buy bin bags ${stamp}`;
  addDueItem(bucketId, friendEmail, forSam, friendEmail);
  addDueItem(bucketId, friendEmail, forMe, ownerEmail);
  addDueItem(bucketId, friendEmail, forBoth, ownerEmail, friendEmail);

  await page.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(page, forSam)).toContainText(sam);
  await expect(itemRow(page, forMe)).toContainText("you");
  await expect(itemRow(page, forBoth)).toContainText(`you, ${sam}`);

  await page.getByRole("button", { name: "today", exact: true }).click();
  const today = page.getByRole("region", { name: "overdue" });
  await expect(today.getByRole("button", { name: forSam })).toContainText(sam);
  await expect(today.getByRole("button", { name: forMe })).toContainText("you");
  await expect(today.getByRole("button", { name: forBoth })).toContainText(`you, ${sam}`);

  await page.getByRole("button", { name: "search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "search" });
  await search.getByRole("textbox", { name: "search all items" }).fill(String(stamp));
  await expect(search.getByRole("button", { name: forSam })).toContainText(sam);
  await expect(search.getByRole("button", { name: forMe })).toContainText("you");
  await expect(search.getByRole("button", { name: forBoth })).toContainText(`you, ${sam}`);
});

test("a shared bucket shows only my items or one member's, says no one on the rest and who ticked one", async ({
  page,
  browser,
}) => {
  const {
    bucketId,
    code,
    email: ownerEmail,
  } = await ownerWithInvite(page, `whose turn ${Date.now()}`);
  const friend = await browser.newPage();
  const sam = uniqueUsername("sam");
  const friendEmail = await joinWithCode(friend, code, sam);
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await friend.close();
  const stamp = Date.now();
  const forSam = `water the plants ${stamp}`;
  const forMe = `book the vet ${stamp}`;
  const forNobody = `buy bin bags ${stamp}`;
  addDueItem(bucketId, friendEmail, forSam, friendEmail);
  addDueItem(bucketId, friendEmail, forMe, ownerEmail);
  addDueItem(bucketId, friendEmail, forNobody);

  await page.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(page, forNobody)).toContainText("no one");
  const filter = page.getByRole("group", { name: "show items for" });

  await filter.getByRole("button", { name: "mine", exact: true }).click();
  await expect(itemRow(page, forMe)).toBeVisible();
  await expect(itemRow(page, forSam)).toHaveCount(0);
  await expect(itemRow(page, forNobody)).toHaveCount(0);

  await filter.getByRole("button", { name: sam, exact: true }).click();
  await expect(itemRow(page, forSam)).toBeVisible();
  await expect(itemRow(page, forMe)).toHaveCount(0);

  await filter.getByRole("button", { name: "all", exact: true }).click();
  await expect(itemRow(page, forNobody)).toBeVisible();
  await expect(page.getByRole("button", { name: /2 people/ })).toBeVisible();

  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    "update items set status = 'completed', completed_by = (select id from users where email = ?) where title = ?"
  ).run(friendEmail, forNobody);
  db.close();
  await page.reload();
  await expect(itemRow(page, forNobody)).toContainText(`ticked by ${sam}`);
  await expect(itemRow(page, forNobody)).not.toContainText("no one");
});

test("the item menu adds a member in one tap, and a second tap takes them off again", async ({
  page,
  browser,
}) => {
  const { bucketId, code } = await ownerWithInvite(page, `chores ${Date.now()}`);
  const friend = await browser.newPage();
  const sam = uniqueUsername("sam");
  const friendEmail = await joinWithCode(friend, code, sam);
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await friend.close();
  const title = `mow the lawn ${Date.now()}`;
  addDueItem(bucketId, friendEmail, title);

  await page.goto(`/?bucket=${bucketId}`);
  await expect(itemRow(page, title)).toContainText("no one");
  const menu = await openItemMenu(page, title);
  const chip = menu.getByRole("group", { name: "assign to" }).getByRole("button", { name: sam });
  await chip.click();
  await expect(itemRow(page, title)).toContainText(sam);
  await expect(menu).toBeVisible();
  await expect(chip).toHaveAttribute("aria-pressed", "true");

  await chip.click();
  await expect(itemRow(page, title)).toContainText("no one");
  await expect(chip).toHaveAttribute("aria-pressed", "false");
});

test("typing @ in the title picks a member in a shared bucket, and does nothing in a solo one", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("e2e-mention-owner");
  await login(page, email);
  const bucketId = addBucket(email, `mention ${Date.now()}`);
  await page.goto(`/?bucket=${bucketId}`);

  await page.getByRole("button", { name: "add with details", exact: true }).click();
  const solo = newItemForm(page);
  await solo.locator("textarea").fill("@");
  await expect(solo.getByRole("listbox")).toHaveCount(0);
  await solo.locator("textarea").fill("remind @sa about it");
  await expect(solo.getByRole("listbox")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await openMembers(page);
  await page.getByRole("button", { name: bracket("create invite") }).click();
  const code = (await page.getByTestId("invite-code").textContent()) ?? "";
  const friend = await browser.newPage();
  const sam = uniqueUsername("sam");
  await joinWithCode(friend, code, sam);
  await friend.waitForURL(`/?bucket=${bucketId}`);
  await friend.close();

  await page.goto(`/?bucket=${bucketId}`);
  await page.getByRole("button", { name: "add with details", exact: true }).click();
  const dialog = newItemForm(page);
  const title = dialog.locator("textarea");

  await title.fill("mail bob@example.com");
  await expect(dialog.getByRole("listbox")).toHaveCount(0);

  await title.fill("buy oat milk @sa");
  await expect(dialog.getByRole("option", { name: new RegExp(`^${sam}`) })).toBeVisible();
  await title.press("Escape");
  await expect(dialog.getByRole("listbox")).toHaveCount(0);
  await expect(title).toHaveValue("buy oat milk @sa");
  await expect(page.getByText("new item", { exact: true })).toBeVisible();

  await title.press("m");
  await expect(dialog.getByRole("option", { name: new RegExp(`^${sam}`) })).toBeVisible();
  await title.press("Enter");
  await expect(title).toHaveValue("buy oat milk");
  await expect(detailChip(dialog, "assignee")).toHaveAccessibleName(`assignee: ${sam}`);
  await dialog.getByRole("button", { name: "add", exact: true }).click();
  await expect(itemRow(page, "buy oat milk")).toContainText(sam);

  await page.getByRole("button", { name: "add with details", exact: true }).click();
  await title.fill("water the plants @");
  await expect(dialog.getByRole("option")).toHaveCount(3);
  await title.press("ArrowDown");
  await expect(dialog.getByRole("option", { name: new RegExp(`^${sam}`) })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await dialog.getByRole("option", { name: new RegExp(`^${sam}`) }).click();
  await expect(title).toHaveValue("water the plants");
  await expect(detailChip(dialog, "assignee")).toHaveAccessibleName(`assignee: ${sam}`);
});

test("people see each other's avatars next to their names, a generated one if never drawn", async ({
  page,
  browser,
}) => {
  const { bucketId, code } = await ownerWithInvite(page, `avatars ${Date.now()}`);
  const friend = await browser.newPage();
  const sam = uniqueUsername("sam");
  const friendEmail = await joinWithCode(friend, code, sam);
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
  await closeDialog(settingsDialog(page));

  await page.getByRole("button", { name: "add with details", exact: true }).click();
  const dialog = newItemForm(page);
  await openDetail(dialog, "assignee");
  await expect(sams(dialog.getByRole("button", { name: sam, exact: true }))).toHaveAttribute(
    "width",
    "16"
  );
  await dialog.locator("textarea").fill("call @sa");
  await expect(sams(page.getByRole("listbox", { name: "assign to" }))).toHaveCount(1);
  await page.keyboard.press("Enter");
  const title = `call ${Date.now()}`;
  await dialog.locator("textarea").fill(title);
  await assignOnly(dialog, sam);
  await dialog.getByRole("button", { name: "add", exact: true }).click();
  await expect(itemRow(page, title)).toContainText(sam);

  const fromBox = `water the plants ${Date.now()}`;
  const box = page.getByRole("textbox", { name: /^add to / });
  await box.fill(`${fromBox} @${sam}`);
  await page.getByRole("listbox", { name: "assign to" }).getByRole("option", { name: sam }).click();
  await expect(box).toHaveValue(fromBox);
  await expect(page.getByTestId("quick-add-hint")).toHaveText(`@${sam}`);
  await box.press("Enter");
  await expect(itemRow(page, fromBox)).toContainText(sam);
  await expect(sams(itemRow(page, title))).toHaveAttribute("width", "16");

  await itemRow(page, title).click();
  await editForm(page).getByRole("button", { name: "delete item" }).click();
  await expect(itemRow(page, title)).toHaveCount(0);
  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "trash", exact: true }).click();
  const trashed = page
    .getByRole("dialog", { name: "trash" })
    .getByRole("region", { name: "items" })
    .locator("div.flex.items-center")
    .filter({ has: page.getByText(title, { exact: true }) });
  await expect(trashed).toContainText("deleted by you");
  await expect(trashed.locator('svg[width="16"] rect')).not.toHaveCount(0);
});
