import { test, expect, type Page } from "@playwright/test";
import { login, uniqueEmail } from "../helpers/login";
import { activeBucketTitle, addItem } from "../helpers/buckets";
import { E2E_STARTER_EMAIL_PREFIX, GUIDE_TASKS } from "@/lib/guide/constants";

const TOTAL = GUIDE_TASKS.length;

function guideButton(page: Page) {
  return page.getByRole("button", { name: /^\[ guide \d+\/\d+ \]$/ });
}

function guidePanel(page: Page) {
  return page.getByRole("dialog", { name: "getting started" });
}

function task(page: Page, title: string) {
  return guidePanel(page).getByRole("listitem", { name: title });
}

// Parallel tests can start in the same millisecond, the test's own id keeps their accounts apart
async function signUp(page: Page) {
  const { testId, repeatEachIndex } = test.info();
  await login(page, uniqueEmail(`${E2E_STARTER_EMAIL_PREFIX}-${testId}-${repeatEachIndex}`));
  await expect(activeBucketTitle(page)).toHaveText("reminders");
}

test("a new account starts on reminders, and a done task ticks and pays", async ({ page }) => {
  await signUp(page);
  await expect(guideButton(page)).toHaveAccessibleName(`[ guide 0/${TOTAL} ]`);

  await addItem(page, "pay rent");
  await expect(page.getByText("add a reminder · +2 capy credits")).toBeVisible();
  await expect(guideButton(page)).toHaveAccessibleName(`[ guide 1/${TOTAL} ]`);

  await guideButton(page).click();
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

test("the guide button can leave the header, the guide stays in the menu", async ({ page }) => {
  await signUp(page);

  await guideButton(page).click();
  await guidePanel(page).getByRole("button", { name: "[ hide from header ]" }).click();
  await guidePanel(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(guideButton(page)).toBeHidden();

  await page.reload();
  await expect(activeBucketTitle(page)).toHaveText("reminders");
  await expect(guideButton(page)).toBeHidden();
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: `getting started 0/${TOTAL}` }).click();
  await guidePanel(page).getByRole("button", { name: "[ show in header ]" }).click();
  await guidePanel(page).getByRole("button", { name: "[ x ]" }).click();
  await expect(guideButton(page)).toHaveAccessibleName(`[ guide 0/${TOTAL} ]`);
});

test("a hint takes you to the place the task is done", async ({ page }) => {
  await signUp(page);

  await guideButton(page).click();
  await task(page, "pick a theme").getByRole("button", { name: "[ hint ]" }).click();
  await expect(guidePanel(page)).toBeHidden();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await expect(tweaks).toBeVisible();
  await expect(tweaks.getByRole("button", { name: "appearance", exact: true })).toHaveClass(
    /bg-foreground/
  );
  await expect(page.getByText("pick any theme you like")).toBeVisible();
  await tweaks.getByRole("button", { name: "[ x ]" }).click();

  await guideButton(page).click();
  await task(page, "invite someone to a bucket").getByRole("button", { name: "[ hint ]" }).click();
  await expect(page.getByRole("button", { name: "[ create invite ]" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "[ create invite ]" })).toBeHidden();

  await guideButton(page).click();
  await task(page, "add a reminder").getByRole("button", { name: "[ hint ]" }).click();
  await expect(page.getByText("new item", { exact: true })).toBeVisible();
});

test("picking a theme ticks its task, the theme saves itself", async ({ page }) => {
  await signUp(page);

  await guideButton(page).click();
  await task(page, "pick a theme").getByRole("button", { name: "[ hint ]" }).click();
  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  await tweaks.getByRole("button", { name: /nord/i }).first().click();

  await expect(page.getByText(/^pick a theme · \+\d+ capy credits$/)).toBeVisible();
  await tweaks.getByRole("button", { name: "[ x ]" }).click();
  await expect(guideButton(page)).toHaveAccessibleName(`[ guide 1/${TOTAL} ]`);
});

test("show me in what's new opens the guide", async ({ page }) => {
  await login(page, uniqueEmail("e2e-show-me"));

  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: /^what's new/ }).click();
  await page
    .getByRole("dialog", { name: "what's new" })
    .getByRole("button", { name: "[ show me ]" })
    .click();
  await expect(guidePanel(page)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "what's new" })).toBeHidden();
});
