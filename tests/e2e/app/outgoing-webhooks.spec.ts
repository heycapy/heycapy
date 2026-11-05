import { test, expect, type Locator, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import { E2E_DATABASE_FILE } from "../helpers/env";

test.use({ storageState: authState("outgoing-webhooks") });
test.describe.configure({ mode: "default" });

// A failed test can leave its webhooks behind, and a retry adding the same names would be refused
test.beforeEach(() => {
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    "delete from outgoing_webhooks where user_id = (select id from users where email = ?)"
  ).run(specUserEmail("outgoing-webhooks"));
  db.close();
});

const NAME = "work slack";
const URL_FIELD = "https://example.com/hooks/heycapy";

async function openWebhooks(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  return page
    .locator("div")
    .filter({ has: page.getByText("other apps", { exact: true }) })
    .last();
}

async function addWebhook(box: Locator, name: string, url: string) {
  await box.getByRole("button", { name: "[ add app + ]" }).click();
  await box.getByPlaceholder(NAME).fill(name);
  await box.getByPlaceholder(URL_FIELD).fill(url);
  await box.getByRole("button", { name: "[ save ]" }).click();
  await expect(box.getByRole("button", { name: "[ send test ]" })).toBeVisible();
}

test("a webhook is added once in tweaks, tested, kept and deleted", async ({ page }) => {
  let box = await openWebhooks(page);
  await box.getByRole("button", { name: "[ add app + ]" }).click();
  await box.getByPlaceholder(URL_FIELD).fill("https://discord.com/api/webhooks/1/abc");
  await expect(box.getByText("discord link · sent as a normal discord message")).toBeVisible();
  await box.getByRole("button", { name: "[ cancel ]" }).click();

  await addWebhook(box, "home assistant", "https://example.com/hooks/heycapy");
  await expect(box.getByText(/^whsec_•+$/)).toBeVisible();
  await box.getByRole("button", { name: "[ show ]" }).click();
  await expect(box.getByText(/^whsec_[A-Za-z0-9+/]{43}=$/)).toBeVisible();
  await box.getByRole("button", { name: "[ send test ]" }).click();
  await expect(box.getByText("sent ✓ — check that it arrived")).toBeVisible();
  await box.getByRole("button", { name: "[ done ]" }).click();
  await expect(box.getByText("example.com · on by default")).toBeVisible();

  box = await openWebhooks(page);
  await box.getByRole("button", { name: "[ edit ]" }).click();
  await expect(box.getByPlaceholder(NAME)).toHaveValue("home assistant");
  await box.getByRole("button", { name: "[ delete ]" }).click();
  await box.getByRole("button", { name: "[ confirm ]" }).click();
  await expect(box.getByPlaceholder(NAME)).toBeHidden();
  await expect(box.getByText("home assistant", { exact: true })).toBeHidden();

  box = await openWebhooks(page);
  await expect(box.getByRole("button", { name: "[ add app + ]" })).toBeVisible();
  await expect(box.getByText("home assistant", { exact: true })).toBeHidden();
});

test("discord and slack webhooks show as rows and have no signing secret", async ({ page }) => {
  const box = await openWebhooks(page);
  await addWebhook(box, "team", "https://discord.com/api/webhooks/1/abc");
  await expect(box.getByText("secret", { exact: true })).toBeHidden();
  await box.getByRole("button", { name: "[ done ]" }).click();
  await addWebhook(box, "work", "https://hooks.slack.com/services/T0/B0/x");
  await box.getByRole("button", { name: "[ done ]" }).click();

  await expect(box.getByText("discord · on by default")).toBeVisible();
  await expect(box.getByText("slack · on by default")).toBeVisible();
  await expect(box.getByPlaceholder(NAME)).toBeHidden();

  for (const name of ["team", "work"]) {
    await box.getByRole("button", { name: "[ edit ]" }).first().click();
    await expect(box.getByPlaceholder(NAME)).toHaveValue(name);
    await box.getByRole("button", { name: "[ delete ]" }).click();
    await box.getByRole("button", { name: "[ confirm ]" }).click();
    await expect(box.getByPlaceholder(NAME)).toBeHidden();
  }
  await expect(box.getByRole("button", { name: "[ edit ]" })).toHaveCount(0);
});

test("opening another webhook while one is still deleting keeps it open", async ({ page }) => {
  const box = await openWebhooks(page);
  await addWebhook(box, "old", "https://hooks.slack.com/services/T0/B0/old");
  await box.getByRole("button", { name: "[ done ]" }).click();
  await addWebhook(box, "new", "https://hooks.slack.com/services/T0/B0/new");
  await box.getByRole("button", { name: "[ done ]" }).click();

  // deleteWebhookAction(id) is held until the other webhook is open
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.headers()["next-action"] && /^\[\d+\]$/.test(request.postData() ?? "")) {
      await held;
    }
    await route.fallback();
  });
  const deleted = page.waitForResponse((r) => /^\[\d+\]$/.test(r.request().postData() ?? ""));

  await box.getByRole("button", { name: "[ edit ]" }).first().click();
  await expect(box.getByPlaceholder(NAME)).toHaveValue("old");
  await box.getByRole("button", { name: "[ delete ]" }).click();
  await box.getByRole("button", { name: "[ confirm ]" }).click();
  await box.getByRole("button", { name: "[ edit ]" }).click();
  await expect(box.getByPlaceholder(NAME)).toHaveValue("new");
  release();
  await deleted;
  await page.unroute("**/*");

  await expect(box.getByText("old", { exact: true })).toBeHidden();
  await expect(box.getByPlaceholder(NAME)).toHaveValue("new");
  await box.getByRole("button", { name: "[ delete ]" }).click();
  await box.getByRole("button", { name: "[ confirm ]" }).click();
  await expect(box.getByPlaceholder(NAME)).toBeHidden();
  await expect(box.getByRole("button", { name: "[ edit ]" })).toHaveCount(0);
});
