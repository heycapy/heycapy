import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import { E2E_DATABASE_FILE } from "../helpers/env";

test.use({ storageState: authState("look") });
test.describe.configure({ mode: "serial" });

function setLook(look: string) {
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    "update user_settings set look = ? where user_id = (select id from users where email = ?)"
  ).run(look, specUserEmail("look"));
  db.close();
}

test.afterAll(() => setLook("original"));

test("the page carries the look saved on the account", async ({ page }) => {
  setLook("original");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-look", "original");

  setLook("modern");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-look", "modern");
});

test("pages before login keep the original look under any account look", async ({ page }) => {
  setLook("modern");
  await page.goto("/join/NOTACODE");
  await expect(page.locator("html")).toHaveAttribute("data-look", "modern");

  const wrapper = page.locator("[data-look='original']");
  await expect(wrapper).toBeVisible();
  const kept = await wrapper.evaluate((el) => {
    document.documentElement.style.setProperty("--panel-radius", "9px");
    return getComputedStyle(el).getPropertyValue("--panel-radius");
  });
  expect(kept).toBe("0px");
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the page has the original look", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-look", "original");
  });
});
