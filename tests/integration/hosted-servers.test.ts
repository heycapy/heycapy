import type { LookupAddress } from "node:dns";
import type * as dnsPromises from "node:dns/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, userSettings } from "@/lib/db/schema";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { sendEmail } from "@/lib/notifications/email";
import { publicAddress } from "@/lib/notifications/public-address";
import {
  sendTestNotificationAction,
  testSmtpAction,
  updateUserSettingsAction,
} from "@/app/(app)/user-settings-actions";
import { resetSchedulerEnvironment, seedUser, useSchedulerEnvironment } from "./helpers";
import { startNtfyServer, type NtfyServer } from "./ntfy-server";

const session = vi.hoisted(() => ({ userId: 0, email: "someone@heycapy.test" }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => session,
  deleteSession: async () => {},
}));

const fakeDns = vi.hoisted(() => new Map<string, LookupAddress[]>());
vi.mock("node:dns/promises", async (importOriginal) => {
  const real = await importOriginal<typeof dnsPromises>();
  return {
    ...real,
    lookup: async (name: string, options: { all: true }) =>
      fakeDns.get(name) ?? real.lookup(name, options),
  };
});

const transports = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("nodemailer", () => {
  const createTransport = (options: Record<string, unknown>) => {
    transports.push(options);
    return { sendMail: async () => ({}) };
  };
  return { default: { createTransport }, createTransport };
});

const PUBLIC_MAIL = "mail.example.test";
const email = { to: "someone@heycapy.test", subject: "s", text: "t" };
const smtp = (smtpHost: string) => ({ emailProvider: "smtp", smtpHost, smtpPort: 587 });

let ntfy: NtfyServer;
beforeEach(async () => {
  useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z"));
  vi.stubEnv("HOSTED", "true");
  delete process.env.E2E_TEST_MODE;
  fakeDns.set(PUBLIC_MAIL, [{ address: "93.184.215.14", family: 4 }]);
  session.userId = await seedUser();
  ntfy = await startNtfyServer();
});
afterEach(async () => {
  resetSchedulerEnvironment();
  vi.unstubAllEnvs();
  fakeDns.clear();
  transports.length = 0;
  await ntfy.close();
});

it.each([
  "localhost",
  "127.0.0.1",
  "10.0.0.8",
  "172.20.1.1",
  "192.168.1.1",
  "169.254.169.254",
  "100.64.0.1",
  "0.0.0.0",
  "[::1]",
  "::ffff:127.0.0.1",
  "fdaa:0:1::3",
  "fe80::1",
  "64:ff9b::a9fe:a9fe",
])("refuses %s on a hosted server", async (host) => {
  await expect(publicAddress(host)).rejects.toThrow("points to a private network");
});

it("allows public addresses, and self-hosted servers skip the check", async () => {
  expect(await publicAddress("1.1.1.1")).toEqual({ address: "1.1.1.1", family: 4 });
  expect(await publicAddress("[2606:4700::1111]")).toEqual({
    address: "2606:4700::1111",
    family: 6,
  });
  vi.stubEnv("HOSTED", "false");
  expect(await publicAddress("localhost")).toBeNull();
});

it("a name that doesn't resolve gets a readable error", async () => {
  await expect(publicAddress("nothing.invalid")).rejects.toThrow(
    "couldn't find nothing.invalid. check the address"
  );
});

it("an ntfy reminder to a server on our own network fails without reaching it", async () => {
  await db
    .update(userSettings)
    .set({ notificationsPush: true, ntfyUrl: ntfy.url, ntfyTopic: "capy" })
    .where(eq(userSettings.userId, session.userId));

  await enqueue({ userId: session.userId, medium: "ntfy", title: "t", message: "m" });
  await processPending();

  const [job] = await db
    .select()
    .from(notificationQueue)
    .where(eq(notificationQueue.userId, session.userId));
  expect(job.status).toBe("pending");
  expect(job.lastError).toContain("points to a private network");
  expect(ntfy.bodies).toEqual([]);
});

it("the ntfy send test refuses it too", async () => {
  const url = ntfy.url.replace("127.0.0.1", "localhost");
  expect(await sendTestNotificationAction("ntfy", { url, topic: "capy" })).toEqual({
    ok: false,
    error: "localhost points to a private network. use a public server",
  });
  expect(ntfy.bodies).toEqual([]);
});

it("smtp on our own network is refused before connecting, on a send and on the test", async () => {
  await expect(sendEmail(email, smtp("127.0.0.1"))).rejects.toThrow("points to a private network");
  expect(
    await testSmtpAction({
      smtpHost: "169.254.169.254",
      smtpPort: "25",
      smtpUser: "",
      smtpPass: null,
      smtpSecure: false,
      sendTo: "someone@heycapy.test",
    })
  ).toMatchObject({ ok: false, error: expect.stringContaining("private network") });
  expect(transports).toEqual([]);
});

it("smtp connects to the address that was checked, with the certificate checked for the name", async () => {
  await sendEmail(email, smtp(PUBLIC_MAIL));
  expect(transports).toEqual([
    expect.objectContaining({ host: "93.184.215.14", tls: { servername: PUBLIC_MAIL } }),
  ]);

  vi.stubEnv("HOSTED", "false");
  await sendEmail(email, smtp("localhost"));
  expect(transports[1]).toMatchObject({ host: "localhost" });
  expect(transports[1]).not.toHaveProperty("tls");
});

it("saving an ntfy url or smtp host on our own network is refused", async () => {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
  });
  if (!settings) throw new Error("no settings");
  const base = {
    ...settings,
    aiApiKey: null,
    smtpPass: null,
    smtpSecure: settings.smtpSecure ?? false,
    transcriptionApiKey: null,
  };
  fakeDns.set("my-app.internal", [{ address: "fdaa:0:1:a7b::2", family: 6 }]);

  expect(await updateUserSettingsAction({ ...base, ntfyUrl: ntfy.url })).toEqual({
    ok: false,
    error: "127.0.0.1 points to a private network. use a public server",
  });
  expect(await updateUserSettingsAction({ ...base, ...smtp("my-app.internal") })).toEqual({
    ok: false,
    error: "my-app.internal points to a private network. use a public server",
  });
  expect(await updateUserSettingsAction({ ...base, ntfyUrl: "not a url" })).toEqual({
    ok: false,
    error: "ntfy server url is not valid",
  });
  expect(await updateUserSettingsAction({ ...base, ...smtp(PUBLIC_MAIL) })).toMatchObject({
    ok: true,
  });

  const saved = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.userId),
  });
  expect(saved).toMatchObject({ ntfyUrl: null, smtpHost: PUBLIC_MAIL });
});
