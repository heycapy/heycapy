import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import { E2E_DATABASE_FILE } from "../helpers/env";

test.use({ storageState: authState("chat-progress") });
test.describe.configure({ mode: "default" });

type Turn = { delayMs: number; status?: number; message?: Record<string, unknown> };

// Stands in for Ollama: each request gets the next scripted turn, after its delay
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
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    `update user_settings set ai_provider = 'ollama', ai_model = 'e2e', ai_ollama_url = ?
     where user_id = (select id from users where email = ?)`
  ).run(`http://127.0.0.1:${port}`, specUserEmail("chat-progress"));
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

  const status = page.getByRole("status");
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
