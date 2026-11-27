import { parseItemId } from "@/lib/items/item-id";
import type { ItemId } from "@/types/ids";
export function itemLink(path: string): { bucketId: number | null; itemId: ItemId } | null {
  const url = new URL(path, "http://app");
  const itemId = parseItemId(/^#item-(.+)$/.exec(url.hash)?.[1]);
  if (url.pathname !== "/" || !itemId) return null;
  const bucket = url.searchParams.get("bucket");
  return {
    bucketId: bucket && /^\d+$/.test(bucket) ? Number(bucket) : null,
    itemId,
  };
}
