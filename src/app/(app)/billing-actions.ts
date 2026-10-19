"use server";

import { z } from "zod";
import { CREDIT_PACK_IDS } from "@/constants";
import type { ActionResult } from "@/types/result";
import { getSession } from "@/lib/auth/session";
import { availablePacks, createCheckout, type PackOffer } from "@/lib/billing/dodo";

const PackSchema = z.enum(CREDIT_PACK_IDS);

export async function getCreditPacksAction(): Promise<ActionResult<{ packs: PackOffer[] }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  return { ok: true, packs: availablePacks(session.email) };
}

export async function startCheckoutAction(pack: string): Promise<ActionResult<{ url: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const parsed = PackSchema.safeParse(pack);
  if (!parsed.success) return { ok: false, error: "Unknown pack" };
  return createCheckout(session.userId, session.email, parsed.data);
}
