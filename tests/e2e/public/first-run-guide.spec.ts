import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { login, uniqueEmail } from "../helpers/login";
import { activeBucketTitle, addItem } from "../helpers/buckets";
import { NOTIFY_MS } from "@/components/ui/constants";
import { E2E_STARTER_EMAIL_PREFIX, GUIDE_TASKS } from "@/lib/guide/constants";

const TOTAL: number = GUIDE_TASKS.length;

function yourMenu(page: Page) {
  return page.getByRole("button", { name: "your menu", exact: true });
}

function guideItem(page: Page, done = /\d+/, total = TOTAL) {
  return page
    .getByRole("button", { name: new RegExp(`^getting started ${done.source}/${total}$`) })
    .and(page.locator("button:not(header button)"));
}

async function openGuide(page: Page, total = TOTAL) {
  await yourMenu(page).click();
  await guideItem(page, /\d+/, total).click();
}

async function expectGuideDone(page: Page, done: number) {
  await yourMenu(page).click();
  await expect(guideItem(page, new RegExp(String(done)))).toBeVisible();
  await page.mouse.click(1, 400);
  await expect(guideItem(page)).toBeHidden();
}

function guidePanel(page: Page) {
  return page.getByRole("dialog", { name: "getting started" });
}

function lookPicker(page: Page) {
  return page.getByRole("dialog", { name: "pick a look" });
}

function task(page: Page, title: string) {
  return guidePanel(page).getByRole("listitem", { name: title });
}

// Parallel tests can start in the same millisecond, the test's own id keeps their accounts apart
async function newAccount(page: Page): Promise<string> {
  const { testId, repeatEachIndex } = test.info();
  const email = uniqueEmail(`${E2E_STARTER_EMAIL_PREFIX}-${testId}-${repeatEachIndex}`);
  await login(page, email);
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(lookPicker(page)).toBeVisible();
  return email;
}

async function signUp(page: Page): Promise<string> {
  const email = await newAccount(page);
  await lookPicker(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(guidePanel(page)).toBeVisible();
  await guidePanel(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(guidePanel(page)).toBeHidden();
  return email;
}

function userFlag(email: string, column: "guide_seen" | "look_picked"): boolean {
  const db = new Database(E2E_DATABASE_FILE);
  const row = db.prepare(`select ${column} as flag from users where email = ?`).get(email) as
    { flag: number } | undefined;
  db.close();
  return row?.flag === 1;
}

function resetLookPicked(email: string) {
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare("update users set look_picked = 0 where email = ?").run(email);
  db.close();
}

test("the guide opens by itself on the first visit only", async ({ page }) => {
  const email = await signUp(page);
  // marked seen without waiting, a reload before it lands would rightly open the guide again
  await expect.poll(() => userFlag(email, "guide_seen")).toBe(true);

  await page.reload();
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(guidePanel(page)).toBeHidden();
  await openGuide(page);
  await expect(guidePanel(page)).toBeVisible();
});

test("a new account starts on reminders, and a done task ticks and pays", async ({ page }) => {
  await signUp(page);
  await expectGuideDone(page, 0);

  await addItem(page, "pay rent");
  await expect(page.getByText("add a reminder · +2 capy credits")).toBeVisible();
  await expectGuideDone(page, 1);

  await openGuide(page);
  await expect(guidePanel(page).getByText(`1 of ${TOTAL} done`)).toBeVisible();
  await expect(guidePanel(page).getByLabel("credits earned")).toHaveText(
    `2 / ${GUIDE_TASKS.reduce((sum, t) => sum + t.credits, 0)} credits`
  );
  const added = task(page, "add a reminder");
  await expect(added).toHaveAttribute("data-done", "true");
  await expect(added.getByRole("button", { name: "[ hint ]" })).toBeVisible();
  await expect(added).toContainText("+2");
  await expect(task(page, "invite someone to a bucket")).toContainText("+4");
  await expect(task(page, "send a test email from your own email account")).toContainText("+5");
});

test("the guide's header button can go, the guide stays in the menu", async ({ page }) => {
  await signUp(page);
  const inHeader = page.getByRole("banner").getByRole("button", { name: /^getting started / });
  await expect(inHeader).toBeVisible();

  await openGuide(page);
  // hideGuideAction(true): the dot hides before it's saved, and a reload would drop the save
  const saved = page.waitForResponse(
    (r) => r.request().headers()["next-action"] !== undefined && r.request().postData() === "[true]"
  );
  await guidePanel(page).getByRole("button", { name: "[ hide from header ]" }).click();
  await saved;
  await guidePanel(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(inHeader).toHaveCount(0);

  await page.reload();
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(inHeader).toHaveCount(0);
  await openGuide(page);
  await guidePanel(page).getByRole("button", { name: "[ show in header ]" }).click();
  await guidePanel(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(inHeader).toBeVisible();
});

test("a hint takes you to the place the task is done", async ({ page }) => {
  await signUp(page);

  await openGuide(page);
  await task(page, "pick a theme and look").getByRole("button", { name: "[ hint ]" }).click();
  await expect(guidePanel(page)).toBeHidden();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await expect(tweaks).toBeVisible();
  await expect(tweaks.getByRole("button", { name: "appearance", exact: true })).toHaveAttribute(
    "aria-current",
    "true"
  );
  await expect(page.getByText("pick any theme or look you like")).toBeVisible();
  await tweaks.getByRole("button", { name: "[ x ]" }).click();

  await openGuide(page);
  await task(page, "invite someone to a bucket").getByRole("button", { name: "[ hint ]" }).click();
  await expect(page.getByRole("button", { name: "[ create invite ]" })).toBeVisible();
  // While the guide is still closing it holds Escape until settings has set itself up, which a
  // person can't beat but a test can
  await expect(guidePanel(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "[ create invite ]" })).toBeHidden();

  await page.getByRole("button", { name: "today", exact: true }).click();
  await openGuide(page);
  await task(page, "add a reminder").getByRole("button", { name: "[ hint ]" }).click();
  await expect(guidePanel(page)).toBeHidden();
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(page.getByRole("textbox", { name: "add to reminders" })).toBeFocused();

  await openGuide(page);
  await task(page, "make a reminder repeat").getByRole("button", { name: "[ hint ]" }).click();
  await expect(page.getByText("new item", { exact: true })).toBeVisible();
});

test("a hint toast stays until closed, and the next hint replaces it", async ({ page }) => {
  await signUp(page);

  await openGuide(page);
  await task(page, "pick a theme and look").getByRole("button", { name: "[ hint ]" }).click();
  const first = page.getByText("pick any theme or look you like");
  await expect(first).toBeVisible();
  await page.waitForTimeout(NOTIFY_MS.info + 1500);
  await expect(first).toBeVisible();

  await page.getByRole("dialog", { name: "tweaks" }).getByRole("button", { name: "[ x ]" }).click();
  await openGuide(page);
  await task(page, "add a reminder").getByRole("button", { name: "[ hint ]" }).click();
  await expect(first).toBeHidden();
  const second = page
    .getByRole("status")
    .filter({ has: page.getByRole("button", { name: "dismiss" }) });
  await expect(second).toHaveCount(1);
  await second.getByRole("button", { name: "dismiss" }).click();
  await expect(second).toBeHidden();
});

test("picking a theme ticks its task, the theme saves itself", async ({ page }) => {
  await signUp(page);

  await openGuide(page);
  await task(page, "pick a theme and look").getByRole("button", { name: "[ hint ]" }).click();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await tweaks.getByRole("button", { name: /^theme, / }).click();
  await tweaks.getByRole("button", { name: "nord", exact: true }).click();

  await expect(page.getByText(/^pick a theme and look · \+\d+ capy credits$/)).toBeVisible();
  await tweaks.getByRole("button", { name: "[ x ]" }).click();
  await expectGuideDone(page, 2);
});

test("opening tweaks and the shortcuts list tick their tasks and pay nothing", async ({ page }) => {
  await signUp(page);
  // The app's default prefix follows the browser's user agent, and Playwright's Safari device claims to be a Mac
  const isMac = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.userAgent));
  const prefix = isMac ? "Meta+;" : "Control+;";
  await page.keyboard.press(prefix);
  await page.keyboard.press(",");
  await expect(page.getByText("done: open tweaks")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press(prefix);
  await page.keyboard.press("?");
  await expect(page.getByText("done: see the keyboard shortcuts")).toBeVisible();
  await page.keyboard.press("Escape");

  await openGuide(page);
  await expect(task(page, "open tweaks")).toHaveAttribute("data-done", "true");
  await expect(task(page, "see the keyboard shortcuts")).toHaveAttribute("data-done", "true");
  await expect(task(page, "open tweaks")).not.toContainText("+");
  await expect(guidePanel(page).getByLabel("credits earned")).toHaveText(/^0 \/ 48 credits$/);
});

test.describe("on a touchscreen without a keyboard", () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 393, height: 851 } });

  test("the shortcuts task isn't listed", async ({ page }) => {
    await signUp(page);
    await openGuide(page, TOTAL - 1);
    await expect(task(page, "open tweaks")).toBeVisible();
    await expect(task(page, "see the keyboard shortcuts")).toHaveCount(0);
  });
});

test("a new account picks a look before the guide opens, and the pick pays its task", async ({
  page,
}) => {
  const email = await newAccount(page);
  const picker = lookPicker(page);
  await expect(guidePanel(page)).toBeHidden();
  await expect(picker.getByRole("button", { name: "original", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await picker.getByRole("button", { name: "modern", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-look", "modern");
  await expect(picker.getByRole("button", { name: "modern", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByText(/^pick a theme and look · \+\d+ capy credits$/)).toBeVisible();

  const preview = picker.locator("[inert][data-look]");
  await expect(preview).toHaveAttribute("data-look", "modern");
  await picker.getByRole("button", { name: "original", exact: true }).click();
  await expect(preview).toHaveAttribute("data-look", "original");
  await expect(page.locator("html")).toHaveAttribute("data-look", "original");
  await picker.getByRole("button", { name: "modern", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-look", "modern");

  await picker.getByRole("button", { name: "done", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(guidePanel(page)).toBeVisible();
  await expect.poll(() => userFlag(email, "look_picked")).toBe(true);

  await page.reload();
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(page.locator("html")).toHaveAttribute("data-look", "modern");
  await expect(picker).toBeHidden();
});

test("the look picker also picks a theme, and it stays after a reload", async ({ page }) => {
  await newAccount(page);
  const picker = lookPicker(page);

  await picker.getByRole("button", { name: /^theme, / }).click();
  await picker.getByRole("button", { name: "nord", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "nord");
  await expect(picker.getByRole("button", { name: "theme, nord", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: /done/ }).click();
  await expect(picker).toBeHidden();

  await page.reload();
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "nord");
});

test("on a short phone screen the look picker scrolls and keeps done in view", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 560 });
  await newAccount(page);
  const picker = lookPicker(page);
  await expect(picker.getByRole("button", { name: /done/ })).toBeInViewport();
  const box = await picker.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(560);
});

test("an account from before the picker sees it once, closing it keeps the look", async ({
  page,
}) => {
  const email = await signUp(page);
  await expect.poll(() => userFlag(email, "look_picked")).toBe(true);
  resetLookPicked(email);

  await page.reload();
  await expect(lookPicker(page)).toBeVisible();
  await expect(lookPicker(page).getByRole("button", { name: "modern" })).toHaveCount(1);
  await lookPicker(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(lookPicker(page)).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-look", "original");
  await expect.poll(() => userFlag(email, "look_picked")).toBe(true);
  await expectGuideDone(page, 0);

  await page.reload();
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(lookPicker(page)).toBeHidden();
});
