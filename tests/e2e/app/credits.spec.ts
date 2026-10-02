import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import { E2E_DATABASE_FILE } from "../helpers/env";

test.use({ storageState: authState("credits") });
test.describe.configure({ mode: "serial" });

// each test starts on heycapy ai with this many credits
function setBalance(balance: number) {
  const db = new Database(E2E_DATABASE_FILE);
  const { id } = db
    .prepare("select id from users where email = ?")
    .get(specUserEmail("credits")) as { id: number };
  db.prepare("delete from credit_ledger where user_id = ?").run(id);
  db.prepare(
    `update user_settings set ai_provider = null, ai_api_key = null, ai_saved_keys = null, ai_ollama_url = null, ai_use_own_key = 1,
       ai_key_status = null, ai_key_error = null, ai_key_checked_at = null where user_id = ?`
  ).run(id);
  db.prepare("insert into credit_ledger (user_id, amount, kind) values (?, ?, 'grant')").run(
    id,
    balance
  );
  db.close();
}

test("capy's chat shows the credits only when they run low, and says so when they run out", async ({
  page,
}) => {
  setBalance(50);
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat" }).click();
  const strip = page.getByRole("status", { name: "capy's ai" });
  await expect(page.getByPlaceholder("ask capy...")).toBeVisible();
  await expect(strip).toHaveCount(0);

  setBalance(7);
  await page.reload();
  await page.getByRole("button", { name: "Open chat" }).click();
  await expect(strip).toHaveText("capy credits · 7 left · see tweaks → ai");

  setBalance(0);
  await page.reload();
  await page.getByRole("button", { name: "Open chat" }).click();
  await expect(strip).toHaveText("out of capy credits · see tweaks → ai");

  const input = page.getByPlaceholder("ask capy...");
  await input.fill("hello");
  await input.press("Enter");
  await expect(page.getByText(/You're out of capy credits/).first()).toBeVisible();

  await page.getByRole("button", { name: "close chat" }).click();
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "ai", exact: true }).click();
  await expect(page.getByRole("status", { name: "capy's ai" })).toHaveText("out of capy credits");
  await expect(
    page.getByText(
      /each message to capy uses 1 credit, and talking to capy with the mic is included/
    )
  ).toBeVisible();
});

test("heycapy ai or your own key, and a saved key stays for switching back", async ({ page }) => {
  setBalance(50);
  const openAITab = async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "···" }).click();
    await page.getByRole("button", { name: "tweaks" }).click();
    await page.getByRole("button", { name: "ai", exact: true }).click();
  };
  const heycapy = page.getByRole("button", { name: "heycapy ai" });
  const ownKey = page.getByRole("button", { name: "your own key" });
  const keyField = page.getByPlaceholder("sk-...");

  await openAITab();
  await expect(heycapy).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("provider", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "voice", exact: true })).toHaveCount(0);

  await ownKey.click();
  await expect(page.getByRole("button", { name: "voice", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "gemini", exact: true }).click();
  await keyField.fill("e2e-gemini-key");
  await heycapy.click();
  await expect(keyField).toHaveCount(0);
  await page.getByRole("button", { name: "save" }).click();

  await openAITab();
  await expect(heycapy).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status", { name: "capy's ai" })).toHaveText(
    "50 capy credits left (never expire)"
  );
  await ownKey.click();
  await expect(page.getByRole("button", { name: "gemini", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(keyField).toHaveValue("e2e-gemini-key");
});

test("each provider keeps its own key and model when switching between them", async ({ page }) => {
  setBalance(50);
  const openAITab = async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "···" }).click();
    await page.getByRole("button", { name: "tweaks" }).click();
    await page.getByRole("button", { name: "ai", exact: true }).click();
  };
  const keyField = page.getByPlaceholder("sk-...");
  const modelField = page.getByPlaceholder("gpt-4o");
  const provider = (name: string) => page.getByRole("button", { name, exact: true });

  await openAITab();
  await page.getByRole("button", { name: "your own key" }).click();
  await provider("openai").click();
  await keyField.fill("e2e-openai-key");
  await modelField.fill("gpt-4.1-mini");

  await provider("groq").click();
  await expect(keyField).toHaveValue("");
  await keyField.fill("e2e-groq-key");

  await provider("openai").click();
  await expect(keyField).toHaveValue("e2e-openai-key");
  await expect(modelField).toHaveValue("gpt-4.1-mini");
  await provider("groq").click();
  await page.getByRole("button", { name: "save" }).click();

  await openAITab();
  await expect(provider("groq")).toHaveAttribute("aria-pressed", "true");
  await expect(keyField).toHaveValue("e2e-groq-key");
  await provider("openai").click();
  await expect(keyField).toHaveValue("e2e-openai-key");
  await expect(modelField).toHaveValue("gpt-4.1-mini");

  await page.getByRole("button", { name: "clear openai key and model" }).click();
  await expect(keyField).toHaveValue("");
  await expect(modelField).toHaveValue("");
  await provider("groq").click();
  await page.getByRole("button", { name: "save" }).click();

  await openAITab();
  await expect(keyField).toHaveValue("e2e-groq-key");
  await provider("openai").click();
  await expect(keyField).toHaveValue("");
  await expect(page.getByRole("button", { name: "clear openai key and model" })).toHaveCount(0);
});

test("picking heycapy ai describes it at once, not the saved key", async ({ page }) => {
  setBalance(50);
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    `update user_settings set ai_provider = 'groq', ai_api_key = 'e2e-groq-key',
       ai_use_own_key = 1,
       ai_key_status = 'working', ai_key_checked_at = unixepoch()
     where user_id = (select id from users where email = ?)`
  ).run(specUserEmail("credits"));
  db.close();

  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "ai", exact: true }).click();
  const status = page.getByRole("status", { name: "capy's ai" });
  await expect(status).toHaveText("your groq key · working");
  await expect(page.getByText(/last checked/)).toBeVisible();
  await expect(page.getByText("50 capy credits kept for heycapy ai")).toBeVisible();

  await page.getByRole("button", { name: "heycapy ai" }).click();
  await expect(status).toHaveText("50 capy credits left (never expire)");
  await expect(page.getByText(/save to switch to heycapy ai/)).toBeVisible();
  await expect(page.getByText(/last checked/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "check", exact: true })).toHaveCount(0);
});
