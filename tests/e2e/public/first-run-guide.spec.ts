import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { login, uniqueEmail } from "../helpers/login";
import { activeBucketTitle, addItem } from "../helpers/buckets";
import { E2E_STARTER_EMAIL_PREFIX, GUIDE_TASKS } from "@/lib/guide/constants";

const TOTAL = GUIDE_TASKS.length;

function yourMenu(page: Page) {
  return page.getByRole("button", { name: "your menu", exact: true });
}

function guideItem(page: Page, done = /\d+/) {
  return page.getByRole("button", {
    name: new RegExp(`^getting started ${done.source}/${TOTAL}$`),
  });
}

async function openGuide(page: Page) {
  await yourMenu(page).click();
  await guideItem(page).click();
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

function task(page: Page, title: string) {
  return guidePanel(page).getByRole("listitem", { name: title });
}

// Parallel tests can start in the same millisecond, the test's own id keeps their accounts apart
async function signUp(page: Page): Promise<string> {
  const { testId, repeatEachIndex } = test.info();
  const email = uniqueEmail(`${E2E_STARTER_EMAIL_PREFIX}-${testId}-${repeatEachIndex}`);
  await login(page, email);
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(guidePanel(page)).toBeVisible();
  await guidePanel(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(guidePanel(page)).toBeHidden();
  return email;
}

function guideSeen(email: string): boolean {
  const db = new Database(E2E_DATABASE_FILE);
  const row = db.prepare("select guide_seen from users where email = ?").get(email) as
    { guide_seen: number } | undefined;
  db.close();
  return row?.guide_seen === 1;
}

test("the guide opens by itself on the first visit only", async ({ page }) => {
  const email = await signUp(page);
  // marked seen without waiting, a reload before it lands would rightly open the guide again
  await expect.poll(() => guideSeen(email)).toBe(true);

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

test("the dot on your avatar can go, the guide stays in the menu", async ({ page }) => {
  await signUp(page);
  await expect(yourMenu(page)).toHaveAccessibleDescription("something new inside");

  await openGuide(page);
  // hideGuideAction(true): the dot hides before it's saved, and a reload would drop the save
  const saved = page.waitForResponse(
    (r) => r.request().headers()["next-action"] !== undefined && r.request().postData() === "[true]"
  );
  await guidePanel(page).getByRole("button", { name: "[ hide the dot ]" }).click();
  await saved;
  await guidePanel(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(yourMenu(page)).toHaveAccessibleDescription("");

  await page.reload();
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(yourMenu(page)).toHaveAccessibleDescription("");
  await openGuide(page);
  await guidePanel(page).getByRole("button", { name: "[ show the dot ]" }).click();
  await guidePanel(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(yourMenu(page)).toHaveAccessibleDescription("something new inside");
});

test("a hint takes you to the place the task is done", async ({ page }) => {
  await signUp(page);

  await openGuide(page);
  await task(page, "pick a theme").getByRole("button", { name: "[ hint ]" }).click();
  await expect(guidePanel(page)).toBeHidden();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await expect(tweaks).toBeVisible();
  await expect(tweaks.getByRole("button", { name: "appearance", exact: true })).toHaveClass(
    /bg-foreground/
  );
  await expect(page.getByText("pick any theme you like")).toBeVisible();
  await tweaks.getByRole("button", { name: "[ x ]" }).click();

  await openGuide(page);
  await task(page, "invite someone to a bucket").getByRole("button", { name: "[ hint ]" }).click();
  await expect(page.getByRole("button", { name: "[ create invite ]" })).toBeVisible();
  // While the guide is still closing it holds Escape until settings has set itself up, which a
  // person can't beat but a test can
  await expect(guidePanel(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "[ create invite ]" })).toBeHidden();

  await openGuide(page);
  await task(page, "add a reminder").getByRole("button", { name: "[ hint ]" }).click();
  await expect(page.getByText("new item", { exact: true })).toBeVisible();
});

test("picking a theme ticks its task, the theme saves itself", async ({ page }) => {
  await signUp(page);

  await openGuide(page);
  await task(page, "pick a theme").getByRole("button", { name: "[ hint ]" }).click();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await tweaks.getByRole("button", { name: /nord/i }).first().click();

  await expect(page.getByText(/^pick a theme · \+\d+ capy credits$/)).toBeVisible();
  await tweaks.getByRole("button", { name: "[ x ]" }).click();
  await expectGuideDone(page, 1);
});
