import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as DodoModule from "dodopayments";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { checkoutSessions, creditLedger, systemErrors } from "@/lib/db/schema";
import { adjustCredits, creditBalance, holdMessageCredit } from "@/lib/credits";
import { availablePacks, createCheckout, outOfCreditsMessage } from "@/lib/billing/dodo";
import { getCreditPacksAction } from "@/app/(app)/billing-actions";
import { POST as webhookPOST } from "@/app/api/dodo/webhook/route";
import { CREDITS_FREE_GRANT, OUT_OF_CREDITS_BUY_ERROR, OUT_OF_CREDITS_ERROR } from "@/constants";
import { seedUser } from "./helpers";

let sessionUser: { userId: number; email: string } | null = null;
vi.mock("@/lib/auth/session", () => ({ getSession: async () => sessionUser }));

const created = vi.hoisted(() => ({
  calls: [] as unknown[],
  fail: false,
  paymentTotal: 500,
  sessions: 0,
}));
vi.mock("dodopayments", async (importOriginal) => {
  const actual = await importOriginal<typeof DodoModule>();
  class Fake extends actual.default {
    override payments = {
      retrieve: async () => ({ total_amount: created.paymentTotal }),
    } as never;
    override checkoutSessions = {
      create: async (params: unknown) => {
        created.calls.push(params);
        if (created.fail) throw new Error("dodo is down");
        return {
          session_id: `cks_fake_${++created.sessions}`,
          checkout_url: "https://test.checkout.dodopayments.com/session/x",
        };
      },
    } as never;
  }
  return { ...actual, default: Fake };
});

const SECRET_BYTES = "a-test-signing-secret-of-some-length";
const WEBHOOK_KEY = `whsec_${Buffer.from(SECRET_BYTES).toString("base64")}`;

function signed(payload: object, id = "evt_1", signWith = SECRET_BYTES): Request {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", signWith)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return new Request("http://localhost/api/dodo/webhook", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    },
    body,
  });
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    business_id: "bus_1",
    type: "payment.succeeded",
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Payment",
      payment_id: "pay_1",
      checkout_session_id: "cks_known",
      status: "succeeded",
      currency: "USD",
      total_amount: 500,
      product_cart: [{ product_id: "pdt_five", quantity: 1 }],
      customer: { customer_id: "cus_1", email: "a@b.c", name: "A" },
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.stubEnv("HOSTED", "true");
  vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "live_mode");
  vi.stubEnv("DODO_PAYMENTS_API_KEY", "dodo_test_key");
  vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", WEBHOOK_KEY);
  vi.stubEnv("DODO_PRODUCT_ID_PACK_5", "pdt_five");
  vi.stubEnv("DODO_PRODUCT_ID_PACK_10", "pdt_ten");
  vi.stubEnv("APP_URL", "https://app.heycapy.test");
  created.calls = [];
  created.fail = false;
  created.paymentTotal = 500;
});
afterEach(() => vi.unstubAllEnvs());

async function buyer(): Promise<number> {
  const userId = await seedUser();
  await db
    .insert(checkoutSessions)
    .values({ userId, provider: "dodo", sessionId: "cks_known", pack: "pack_5" })
    .onConflictDoUpdate({
      target: [checkoutSessions.provider, checkoutSessions.sessionId],
      set: { userId },
    });
  return userId;
}

it("credits the pack once, keeps the free credits, and ignores a retry", async () => {
  const userId = await buyer();

  const first = await webhookPOST(signed(payment()));
  expect(first.status).toBe(200);
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT + 600);

  const retry = await webhookPOST(signed(payment(), "evt_2"));
  expect(retry.status).toBe(200);
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT + 600);

  const rows = db.select().from(creditLedger).where(eq(creditLedger.userId, userId)).all();
  const purchases = rows.filter((r) => r.kind === "purchase");
  expect(purchases).toHaveLength(1);
  expect(purchases[0]).toMatchObject({ amount: 600, provider: "dodo", providerRef: "pay_1" });
});

it("credits the bigger pack by its product id", async () => {
  const userId = await buyer();
  await webhookPOST(
    signed(
      payment({ payment_id: "pay_ten", product_cart: [{ product_id: "pdt_ten", quantity: 1 }] })
    )
  );
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT + 1400);
});

it("refuses a body signed with another secret and credits nothing", async () => {
  const userId = await buyer();
  const res = await webhookPOST(
    signed(payment({ payment_id: "pay_forged" }), "evt_f", "someone-elses-secret")
  );
  expect(res.status).toBe(401);
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
});

it("acknowledges a payment for a checkout we never started, and logs it", async () => {
  const userId = await buyer();
  const res = await webhookPOST(
    signed(payment({ payment_id: "pay_x", checkout_session_id: "cks_other" }))
  );
  expect(res.status).toBe(200);
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
  expect(
    db
      .select()
      .from(systemErrors)
      .all()
      .some((e) => e.message.includes("didn't start"))
  ).toBe(true);
});

it("acknowledges a payment for a product that isn't a pack and credits nothing", async () => {
  const userId = await buyer();
  const res = await webhookPOST(
    signed(
      payment({ payment_id: "pay_y", product_cart: [{ product_id: "pdt_other", quantity: 1 }] })
    )
  );
  expect(res.status).toBe(200);
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
});

it("ignores events it doesn't handle", async () => {
  const res = await webhookPOST(signed({ ...payment(), type: "payment.failed" }));
  expect(res.status).toBe(200);
});

it("is off without the hosted flag", async () => {
  vi.stubEnv("HOSTED", "false");
  const res = await webhookPOST(signed(payment()));
  expect(res.status).toBe(404);
});

it("starts a checkout for a pack and remembers the session for its user", async () => {
  const userId = await seedUser();
  const result = await createCheckout(userId, "buyer@heycapy.test", "pack_10");
  expect(result).toEqual({ ok: true, url: "https://test.checkout.dodopayments.com/session/x" });
  expect(created.calls[0]).toMatchObject({
    product_cart: [{ product_id: "pdt_ten", quantity: 1 }],
    customer: { email: "buyer@heycapy.test" },
    return_url: "https://app.heycapy.test",
  });
  const row = db.select().from(checkoutSessions).where(eq(checkoutSessions.userId, userId)).get();
  expect(row).toMatchObject({ provider: "dodo", pack: "pack_10" });
});

it("doesn't start a checkout when billing is off or the pack has no product", async () => {
  const userId = await seedUser();
  vi.stubEnv("DODO_PRODUCT_ID_PACK_5", "");
  expect((await createCheckout(userId, "a@b.c", "pack_5")).ok).toBe(false);
  vi.stubEnv("HOSTED", "false");
  expect((await createCheckout(userId, "a@b.c", "pack_10")).ok).toBe(false);
  expect(created.calls).toHaveLength(0);
});

it("says so, and logs it, when dodo fails", async () => {
  const userId = await seedUser();
  created.fail = true;
  const result = await createCheckout(userId, "a@b.c", "pack_5");
  expect(result).toEqual({ ok: false, error: "Couldn't start the checkout. Try again in a bit." });
  expect(
    db.select().from(checkoutSessions).where(eq(checkoutSessions.userId, userId)).all()
  ).toHaveLength(0);
});

it("offers only the packs that have a product, and only when billing is on", async () => {
  expect(availablePacks("a@b.c").map((p) => p.id)).toEqual(["pack_5", "pack_10"]);
  vi.stubEnv("DODO_PRODUCT_ID_PACK_10", "");
  expect(availablePacks("a@b.c")).toEqual([{ id: "pack_5", usd: 5, credits: 600 }]);
  vi.stubEnv("HOSTED", "false");
  expect(availablePacks("a@b.c")).toEqual([]);
});

it("sends the pack list only to a signed in user", async () => {
  sessionUser = null;
  expect(await getCreditPacksAction()).toEqual({ ok: false, error: "Unauthorized" });
  sessionUser = { userId: await seedUser(), email: "a@b.c" };
  const result = await getCreditPacksAction();
  expect(result).toMatchObject({ ok: true, packs: [{ id: "pack_5" }, { id: "pack_10" }] });
});

it("tells a user who ran out to buy more only when they can", () => {
  expect(outOfCreditsMessage()).toBe(OUT_OF_CREDITS_BUY_ERROR);
  vi.stubEnv("HOSTED", "false");
  expect(outOfCreditsMessage()).toBe(OUT_OF_CREDITS_ERROR);
});

function refund(overrides: Record<string, unknown> = {}) {
  return {
    business_id: "bus_1",
    type: "refund.succeeded",
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Refund",
      refund_id: "ref_1",
      payment_id: "pay_1",
      status: "succeeded",
      is_partial: false,
      amount: 500,
      currency: "USD",
      ...overrides,
    },
  };
}

function dispute(type: string, overrides: Record<string, unknown> = {}) {
  return {
    business_id: "bus_1",
    type,
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Dispute",
      dispute_id: "dsp_1",
      payment_id: "pay_1",
      amount: "500",
      currency: "USD",
      ...overrides,
    },
  };
}

let sale = 0;
async function bought(): Promise<{ userId: number; paymentId: string }> {
  sale += 1;
  const userId = await seedUser();
  const paymentId = `pay_sale_${sale}`;
  await db
    .insert(checkoutSessions)
    .values({ userId, provider: "dodo", sessionId: `cks_sale_${sale}`, pack: "pack_5" });
  await webhookPOST(
    signed(
      payment({ payment_id: paymentId, checkout_session_id: `cks_sale_${sale}` }),
      `evt_sale_${sale}`
    )
  );
  return { userId, paymentId };
}

it("takes back the credits of a refunded payment and ignores a retry", async () => {
  const { userId, paymentId } = await bought();
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT + 600);

  const res = await webhookPOST(
    signed(refund({ payment_id: paymentId, refund_id: `r_${paymentId}` }), "evt_r1")
  );
  expect(res.status).toBe(200);
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);

  await webhookPOST(
    signed(refund({ payment_id: paymentId, refund_id: `r_${paymentId}` }), "evt_r2")
  );
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
  const rows = db.select().from(creditLedger).where(eq(creditLedger.userId, userId)).all();
  expect(rows.filter((r) => r.kind === "reversal")).toHaveLength(1);
});

it("takes back only the refunded part of a partly refunded payment", async () => {
  const { userId, paymentId } = await bought();
  created.paymentTotal = 2000;
  await webhookPOST(
    signed(
      refund({ payment_id: paymentId, refund_id: "ref_p1", is_partial: true, amount: 500 }),
      "evt_p1"
    )
  );
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT + 600 - 150);

  await webhookPOST(
    signed(
      refund({ payment_id: paymentId, refund_id: "ref_p2", is_partial: true, amount: 1500 }),
      "evt_p2"
    )
  );
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
});

it("never takes back more than the payment gave", async () => {
  const { userId, paymentId } = await bought();
  await webhookPOST(signed(refund({ payment_id: paymentId, refund_id: "ref_a" }), "evt_a"));
  await webhookPOST(signed(refund({ payment_id: paymentId, refund_id: "ref_extra" }), "evt_b"));
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
});

it("lets the balance go below zero when the credits were already spent", async () => {
  const { userId, paymentId } = await bought();
  adjustCredits(userId, -(CREDITS_FREE_GRANT + 590), "spent", "test");
  expect(creditBalance(userId)).toBe(10);

  await webhookPOST(signed(refund({ payment_id: paymentId, refund_id: "ref_n" }), "evt_n"));
  expect(creditBalance(userId)).toBe(-590);
  expect(holdMessageCredit(userId)).toBeNull();
});

it("takes the credits back when a dispute is lost or accepted, once", async () => {
  const lost = await bought();
  const lostEvent = dispute("dispute.lost", { dispute_id: "dsp_l", payment_id: lost.paymentId });
  await webhookPOST(signed(lostEvent, "evt_d1"));
  expect(creditBalance(lost.userId)).toBe(CREDITS_FREE_GRANT);
  await webhookPOST(signed(lostEvent, "evt_d2"));
  expect(creditBalance(lost.userId)).toBe(CREDITS_FREE_GRANT);

  const accepted = await bought();
  await webhookPOST(
    signed(
      dispute("dispute.accepted", { dispute_id: "dsp_a", payment_id: accepted.paymentId }),
      "evt_d3"
    )
  );
  expect(creditBalance(accepted.userId)).toBe(CREDITS_FREE_GRANT);
});

it("leaves the credits alone while a dispute is open or after it is won", async () => {
  const { userId, paymentId } = await bought();
  await webhookPOST(signed(dispute("dispute.opened", { payment_id: paymentId }), "evt_o"));
  await webhookPOST(signed(dispute("dispute.won", { payment_id: paymentId }), "evt_w"));
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT + 600);
});

it("acknowledges a refund for a payment we never credited and logs it", async () => {
  await buyer();
  const res = await webhookPOST(
    signed(refund({ payment_id: "pay_unknown", refund_id: "ref_u" }), "evt_u")
  );
  expect(res.status).toBe(200);
  expect(
    db
      .select()
      .from(systemErrors)
      .all()
      .some((e) => e.message.includes("never credited"))
  ).toBe(true);
});

it("keeps buying to the operators while payments are in test mode", async () => {
  vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "test_mode");
  vi.stubEnv("ADMIN_EMAILS", "boss@heycapy.test");
  expect(availablePacks("someone@heycapy.test")).toEqual([]);
  expect(availablePacks(null)).toEqual([]);
  expect(availablePacks("Boss@heycapy.test").map((p) => p.id)).toEqual(["pack_5", "pack_10"]);
  expect(outOfCreditsMessage()).toBe(OUT_OF_CREDITS_ERROR);

  const stranger = await seedUser();
  expect((await createCheckout(stranger, "someone@heycapy.test", "pack_5")).ok).toBe(false);
  expect(created.calls).toHaveLength(0);
  expect((await createCheckout(stranger, "boss@heycapy.test", "pack_5")).ok).toBe(true);
});
