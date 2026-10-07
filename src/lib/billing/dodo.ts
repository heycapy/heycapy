import DodoPayments from "dodopayments";
import { and, eq } from "drizzle-orm";
import {
  BILLING_PROVIDER,
  CREDIT_PACKS,
  OUT_OF_CREDITS_BUY_ERROR,
  OUT_OF_CREDITS_ERROR,
  type CreditPackId,
} from "@/constants";
import { publicAppUrl } from "@/lib/app-url";
import { grantPurchasedCredits, isHosted, reversePurchase } from "@/lib/credits";
import { db } from "@/lib/db";
import { checkoutSessions } from "@/lib/db/schema";
import { errorMessage } from "@/lib/errors";
import { recordSystemError } from "@/lib/system-errors";

export function dodoEnabled(): boolean {
  return isHosted() && Boolean(process.env.DODO_PAYMENTS_API_KEY);
}

// anything but the exact word live_mode stays in test mode so a typo can never take a real payment
function client(): DodoPayments {
  const environment =
    process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
  return new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
    environment,
  });
}

function productIdOf(pack: CreditPackId): string | null {
  return process.env[CREDIT_PACKS[pack].productEnv] || null;
}

function packOfProduct(productId: string): CreditPackId | null {
  const packs = Object.keys(CREDIT_PACKS) as CreditPackId[];
  return packs.find((pack) => productIdOf(pack) === productId) ?? null;
}

export type PackOffer = { id: CreditPackId; usd: number; credits: number };

// only the packs that have a product to buy, so nothing is offered that can't be paid for
export function availablePacks(): PackOffer[] {
  if (!dodoEnabled() || !publicAppUrl()) return [];
  return (Object.keys(CREDIT_PACKS) as CreditPackId[])
    .filter((id) => productIdOf(id))
    .map((id) => ({ id, usd: CREDIT_PACKS[id].usd, credits: CREDIT_PACKS[id].credits }));
}

// says to buy more only when there is something to buy
export function outOfCreditsMessage(): string {
  return availablePacks().length > 0 ? OUT_OF_CREDITS_BUY_ERROR : OUT_OF_CREDITS_ERROR;
}

export async function createCheckout(
  userId: number,
  email: string,
  pack: CreditPackId
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const productId = productIdOf(pack);
  const returnUrl = publicAppUrl();
  if (!dodoEnabled() || !productId || !returnUrl) {
    return { ok: false, error: "Buying credits isn't available right now." };
  }
  try {
    const session = await client().checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email },
      return_url: returnUrl,
    });
    if (!session.checkout_url) throw new Error("Dodo returned no checkout url");
    db.insert(checkoutSessions)
      .values({ userId, provider: BILLING_PROVIDER, sessionId: session.session_id, pack })
      .run();
    return { ok: true, url: session.checkout_url };
  } catch (err) {
    recordSystemError("dodo-checkout", `creating a checkout failed: ${errorMessage(err)}`, {
      err,
      userId,
      context: { pack },
    });
    return { ok: false, error: "Couldn't start the checkout. Try again in a bit." };
  }
}

type Outcome = { status: number; message: string };

// 401 for a bad signature, 500 so Dodo retries when we couldn't record it, 200 once it is dealt with
export async function handleDodoWebhook(body: string, headers: Headers): Promise<Outcome> {
  let event: ReturnType<DodoPayments["webhooks"]["unwrap"]>;
  try {
    event = client().webhooks.unwrap(body, {
      headers: {
        "webhook-id": headers.get("webhook-id") ?? "",
        "webhook-signature": headers.get("webhook-signature") ?? "",
        "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
      },
    });
  } catch {
    return { status: 401, message: "invalid signature" };
  }

  try {
    if (event.type === "payment.succeeded") return creditPayment(event.data);
    if (event.type === "refund.succeeded") return await takeBackRefund(event.data);
    if (event.type === "dispute.lost" || event.type === "dispute.accepted") {
      return takeBack(event.data.payment_id, event.data.dispute_id, 1);
    }
    return { status: 200, message: "ignored" };
  } catch (err) {
    recordSystemError("dodo-webhook", `${event.type} failed: ${errorMessage(err)}`, { err });
    return { status: 500, message: "failed" };
  }
}

type PaymentData = Extract<
  ReturnType<DodoPayments["webhooks"]["unwrap"]>,
  { type: "payment.succeeded" }
>["data"];

// a payment we can't match is logged and acknowledged, since a retry would never match it either
function creditPayment(payment: PaymentData): Outcome {
  const context = { paymentId: payment.payment_id, sessionId: payment.checkout_session_id };
  const session = payment.checkout_session_id
    ? db
        .select()
        .from(checkoutSessions)
        .where(
          and(
            eq(checkoutSessions.provider, BILLING_PROVIDER),
            eq(checkoutSessions.sessionId, payment.checkout_session_id)
          )
        )
        .get()
    : undefined;
  if (!session) {
    recordSystemError("dodo-webhook", "a payment for a checkout we didn't start", {
      level: "warning",
      context,
    });
    return { status: 200, message: "unknown checkout" };
  }

  const line = payment.product_cart?.[0];
  const pack = line ? packOfProduct(line.product_id) : null;
  if (!line || !pack) {
    recordSystemError("dodo-webhook", "a payment for a product that isn't a credit pack", {
      userId: session.userId,
      context,
    });
    return { status: 200, message: "unknown product" };
  }

  const credits = CREDIT_PACKS[pack].credits * line.quantity;
  const added = grantPurchasedCredits(
    session.userId,
    credits,
    BILLING_PROVIDER,
    payment.payment_id,
    `${pack} bought`
  );
  return { status: 200, message: added ? "credited" : "already credited" };
}

// a refund of part of a payment takes back the same part of its credits
async function takeBackRefund(refund: RefundData): Promise<Outcome> {
  if (!refund.is_partial || typeof refund.amount !== "number") {
    return takeBack(refund.payment_id, refund.refund_id, 1);
  }
  const payment = await client().payments.retrieve(refund.payment_id);
  return takeBack(refund.payment_id, refund.refund_id, refund.amount / payment.total_amount);
}

// a payment that wasn't a credit purchase of ours is logged and acknowledged, since a retry would never match it either
function takeBack(paymentId: string, reversalRef: string, share: number): Outcome {
  const result = reversePurchase(BILLING_PROVIDER, paymentId, reversalRef, share);
  if (result === "no purchase") {
    recordSystemError("dodo-webhook", "a refund or lost dispute for a payment we never credited", {
      level: "warning",
      context: { paymentId, reversalRef },
    });
  }
  return { status: 200, message: result };
}

type RefundData = Extract<
  ReturnType<DodoPayments["webhooks"]["unwrap"]>,
  { type: "refund.succeeded" }
>["data"];
