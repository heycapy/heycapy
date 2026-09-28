"use server";

import type { ActionResult } from "@/types/result";
import { z } from "zod";
import { requireSession } from "./action-helpers";
import { listToday, searchItems, type CrossBucketItems } from "@/lib/items/today";

export async function getTodayAction(): Promise<ActionResult<CrossBucketItems>> {
  const session = await requireSession();
  return { ok: true, ...(await listToday(session.userId)) };
}

const Query = z.string().max(200);

export async function searchItemsAction(query: string): Promise<ActionResult<CrossBucketItems>> {
  const session = await requireSession();
  const parsed = Query.safeParse(query);
  if (!parsed.success) return { ok: false, error: "Search is too long" };
  return { ok: true, ...(await searchItems(session.userId, parsed.data)) };
}
