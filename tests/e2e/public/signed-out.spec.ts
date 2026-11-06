import { test, expect, type Page } from "@playwright/test";
import { addBox, createAndSelectBucket, uniqueName } from "../helpers/buckets";
import { login, uniqueEmail } from "../helpers/login";

// What the tab keeps for whoever is signed in: a chat and an unsent draft
async function leaveTraces(page: Page, secret: string) {
  await createAndSelectBucket(page, uniqueName("Private"));
  await addBox(page).fill(`${secret} draft`);
  await page.evaluate((text) => {
    sessionStorage.setItem(
      "heycapy-chat",
      JSON.stringify({
        state: { messages: [{ role: "user", content: `${text} chat` }], sessionId: 1 },
        version: 0,
      })
    );
  }, secret);
  await expect.poll(() => tabStorage(page)).toContain(`${secret} draft`);
}

function tabStorage(page: Page) {
  return page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)));
}

test("logging out leaves no chat or draft behind in the tab", async ({ page }) => {
  await login(page, uniqueEmail("e2e-signed-out"));
  const secret = uniqueName("secret");
  await leaveTraces(page, secret);

  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "logout", exact: true }).click();
  await page
    .getByRole("button", { name: /log out/ })
    .last()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await tabStorage(page)).not.toContain(secret);
});

test("a session that ends on its own leaves no chat or draft behind either", async ({ page }) => {
  await login(page, uniqueEmail("e2e-session-ended"));
  const secret = uniqueName("secret");
  await leaveTraces(page, secret);

  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => tabStorage(page)).not.toContain(secret);
});
