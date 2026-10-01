import { createHmac } from "node:crypto";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { outgoingWebhooks } from "@/lib/db/schema";
import {
  deleteWebhookAction,
  getWebhooksAction,
  newWebhookSecretAction,
  saveWebhookAction,
  sendTestWebhookAction,
} from "@/app/(app)/webhook-actions";
import { seedUser } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "someone@heycapy.test" }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

type Received = { headers: IncomingHttpHeaders; body: string };

let received: Received[];
let status: number;
let receiver: { url: string; close: () => Promise<void> };

beforeEach(async () => {
  delete process.env.E2E_TEST_MODE;
  session.userId = await seedUser();
  received = [];
  status = 200;
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.writeHead(status).end(status === 200 ? "ok" : "nope");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  receiver = {
    url: `http://127.0.0.1:${port}/hook`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await receiver.close();
});

async function saveWebhook(name = "home", url = receiver.url) {
  const result = await saveWebhookAction({ id: null, name, url, isDefault: true });
  if (!result.ok) throw new Error(result.error);
  return result.webhook;
}

it("a test message arrives signed the Standard Webhooks way", async () => {
  const webhook = await saveWebhook();
  expect(webhook.secret).toMatch(/^whsec_[A-Za-z0-9+/]{43}=$/);

  expect(await sendTestWebhookAction(webhook.id)).toEqual({ ok: true });

  const [{ headers, body }] = received;
  const id = headers["webhook-id"] as string;
  const timestamp = headers["webhook-timestamp"] as string;
  expect(id).toMatch(/^msg_[0-9a-f]{32}$/);
  expect(Math.abs(Number(timestamp) - Date.now() / 1000)).toBeLessThan(5);
  const key = Buffer.from(webhook.secret.slice("whsec_".length), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  expect(headers["webhook-signature"]).toBe(`v1,${expected}`);
  expect(headers["content-type"]).toBe("application/json");
  expect(JSON.parse(body)).toMatchObject({ type: "test", data: { webhook: "home" } });
});

it("a receiver that rejects the test shows its answer", async () => {
  const webhook = await saveWebhook();
  status = 400;
  expect(await sendTestWebhookAction(webhook.id)).toEqual({
    ok: false,
    error: "webhook error 400: nope",
  });
});

it("a new secret replaces the old one for the next message", async () => {
  const webhook = await saveWebhook();
  const result = await newWebhookSecretAction(webhook.id);
  if (!result.ok) throw new Error(result.error);
  expect(result.secret).not.toBe(webhook.secret);
  const listed = await getWebhooksAction();
  expect(listed.ok && listed.webhooks[0].secret).toBe(result.secret);
});

it("the secret is stored encrypted when an encryption key is set", async () => {
  vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
  const webhook = await saveWebhook();
  const [row] = await db.select().from(outgoingWebhooks).where(eq(outgoingWebhooks.id, webhook.id));
  expect(row.secret).toMatch(/^enc:/);
  expect(row.secret).not.toContain(webhook.secret);
  const listed = await getWebhooksAction();
  expect(listed.ok && listed.webhooks[0].secret).toBe(webhook.secret);
});

it("allows three webhooks with different names", async () => {
  await saveWebhook("one");
  expect(
    await saveWebhookAction({ id: null, name: "ONE", url: receiver.url, isDefault: false })
  ).toEqual({ ok: false, error: "you already have a webhook called ONE" });
  await saveWebhook("two");
  await saveWebhook("three");
  expect(
    await saveWebhookAction({ id: null, name: "four", url: receiver.url, isDefault: false })
  ).toEqual({ ok: false, error: "you can have up to 3 webhooks" });
});

it("refuses urls that aren't http or https", async () => {
  for (const [url, error] of [
    ["not a url", "url is not valid"],
    ["ftp://example.com/hook", "url must start with http:// or https://"],
  ]) {
    expect(await saveWebhookAction({ id: null, name: "x", url, isDefault: false })).toEqual({
      ok: false,
      error,
    });
  }
});

it("on a hosted server a webhook can't point at our own network", async () => {
  vi.stubEnv("HOSTED", "true");
  expect(
    await saveWebhookAction({ id: null, name: "x", url: receiver.url, isDefault: false })
  ).toEqual({ ok: false, error: "127.0.0.1 points to a private network. use a public server" });
});

it("another user's webhook can't be tested, changed or deleted", async () => {
  const webhook = await saveWebhook();
  session.userId = await seedUser();

  expect(await sendTestWebhookAction(webhook.id)).toEqual({
    ok: false,
    error: "save the webhook first",
  });
  expect(
    await saveWebhookAction({ id: webhook.id, name: "mine", url: receiver.url, isDefault: false })
  ).toEqual({ ok: false, error: "webhook not found" });
  expect(await newWebhookSecretAction(webhook.id)).toEqual({
    ok: false,
    error: "webhook not found",
  });
  await deleteWebhookAction(webhook.id);
  expect(
    await db.select().from(outgoingWebhooks).where(eq(outgoingWebhooks.id, webhook.id))
  ).toHaveLength(1);
  expect(received).toEqual([]);
});
