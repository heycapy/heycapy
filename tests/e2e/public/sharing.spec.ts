import { test, expect, type Locator, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { addItem, itemRow } from "../helpers/buckets";
import { login, uniqueEmail } from "../helpers/login";
import { modal, option } from "../helpers/settings";

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

async function joinWithCode(page: Page, code: string) {
  await login(page, uniqueEmail("e2e-share-friend"));
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "join a bucket" }).click();
  await page.getByRole("textbox", { name: "invite code" }).fill(code.toLowerCase());
  await page.getByRole("button", { name: bracket("join") }).click();
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

  await openSettings(friend);
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
  await openSettings(friend);
  await friend.getByRole("button", { name: bracket("leave bucket") }).click();
  await friend.getByRole("button", { name: bracket("confirm") }).click();

  await expect(friend.getByText("no buckets yet.")).toBeVisible();
  await page.reload();
  await openMembers(page);
  await expect(page.getByText("people in this bucket (1/5)")).toBeVisible();
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
  await expect(page.getByText(`you still share ${bucketName} with other people`)).toBeVisible();
  await expect(page.getByRole("button", { name: /delete account/ })).toBeDisabled();

  await openSettings(friend);
  await friend.getByRole("button", { name: bracket("leave bucket") }).click();
  await friend.getByRole("button", { name: bracket("confirm") }).click();
  await expect(friend.getByText("no buckets yet.")).toBeVisible();

  await page.reload();
  await openAccountTab(page);
  await expect(page.getByText(/you still share/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /delete account/ })).toBeEnabled();
  await friend.close();
});
