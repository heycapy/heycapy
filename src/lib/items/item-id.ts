import { v7 } from "uuid";
import { z } from "zod";
import type { ItemId } from "@/types/ids";

const ItemIdSchema = z.uuid();

// Time-ordered, so rows made later sort later and the index stays compact
export const newItemId = (): ItemId => v7();

// For ids that arrive as text: Telegram buttons, links, tool calls
export function parseItemId(value: unknown): ItemId | null {
  const parsed = ItemIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
