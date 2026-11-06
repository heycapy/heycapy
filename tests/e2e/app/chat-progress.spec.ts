import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import {
  activeBucketTitle,
  addItem,
  createAndSelectBucket,
  itemRow,
  uniqueName,
} from "../helpers/buckets";
import { E2E_DATABASE_FILE, E2E_SERVER_OLLAMA_PORT } from "../helpers/env";

test.use({ storageState: authState("chat-progress") });
test.describe.configure({ mode: "default" });

type Turn = { delayMs: number; status?: number; message?: Record<string, unknown> };

// stands in for the server ollama and each request gets the next scripted turn after its delay
let turns: Turn[] = [];
let server: Server;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    const turn = turns.shift() ?? { delayMs: 0, message: { role: "assistant", content: "ok" } };
    setTimeout(() => {
      res.writeHead(turn.status ?? 200, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: turn.message ?? {} }));
    }, turn.delayMs);
  });
  await new Promise<void>((resolve) => server.listen(E2E_SERVER_OLLAMA_PORT, "127.0.0.1", resolve));

  const db = new Database(E2E_DATABASE_FILE);
  const { id } = db
    .prepare("select id from users where email = ?")
    .get(specUserEmail("chat-progress")) as { id: number };
  db.prepare(
    "update user_settings set ai_provider = null, ai_api_key = null, ai_ollama_url = null where user_id = ?"
  ).run(id);
  db.prepare("delete from credit_ledger where user_id = ?").run(id);
  db.close();
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function ask(page: Page, text: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat" }).click();
  const input = page.getByPlaceholder("ask capy...");
  await input.fill(text);
  await input.press("Enter");
}

test("shows what capy is doing while it works, then its reply", async ({ page }) => {
  turns = [
    {
      delayMs: 800,
      message: {
        role: "assistant",
        content: "",
        tool_calls: [{ function: { name: "list_buckets", arguments: {} } }],
      },
    },
    { delayMs: 1500, message: { role: "assistant", content: "you have a few buckets" } },
  ];

  await ask(page, "what buckets do I have?");

  const status = page.getByRole("status", { name: "capy is working" });
  await expect(status).toHaveText("thinking…");
  await expect(status).toHaveText("looking at your buckets…");
  await expect(page.getByText("you have a few buckets")).toBeVisible();
  await expect(status).toHaveCount(0);
});

test("shows the provider's error in the chat", async ({ page }) => {
  turns = [{ delayMs: 0, status: 500 }];

  await ask(page, "hello");

  await expect(page.getByText("Ollama error: 500 Internal Server Error").first()).toBeVisible();
});

test("a link in capy's reply opens the item in place, and the chat stays open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const target = uniqueName("Bills");
  const title = uniqueName("pay rent");
  await createAndSelectBucket(page, target);
  await addItem(page, title);
  const anchor = await itemRow(page, title)
    .locator("xpath=ancestor::*[starts-with(@id,'item-')][1]")
    .getAttribute("id");
  const bucketId = await page.evaluate(
    () =>
      (
        JSON.parse(sessionStorage.getItem("heycapy-ui") ?? "{}") as {
          state?: { activeBucketId?: number };
        }
      ).state?.activeBucketId
  );
  await createAndSelectBucket(page, uniqueName("Other"));

  turns = [
    {
      delayMs: 0,
      message: {
        role: "assistant",
        content: `added it: [${title}](/?bucket=${bucketId}#${anchor})`,
      },
    },
  ];
  await page.getByRole("button", { name: "chat with capy" }).click();
  const input = page.getByPlaceholder("ask capy...");
  await input.fill("add pay rent");
  await input.press("Enter");
  // a reload would forget this
  await page.evaluate(() => Object.assign(window, { stayedOnPage: true }));
  await page.getByRole("link", { name: title }).click();

  await expect(activeBucketTitle(page)).toHaveText(target);
  const row = page.locator(`#${anchor}`);
  await expect(row).toBeInViewport();
  await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(input).toBeVisible();
  expect(await page.evaluate(() => "stayedOnPage" in window)).toBe(true);
});
