"use server";

import type { ActionResult } from "@/types/result";
import { revalidatePath } from "next/cache";
import { requireSession } from "./action-helpers";
import {
  deleteItemForever,
  emptyTrash,
  listTrash,
  restoreItem,
  type TrashedBucket,
  type TrashedItem,
} from "@/lib/items/trash";

export async function getTrashAction(): Promise<
  ActionResult<{ buckets: TrashedBucket[]; items: TrashedItem[] }>
> {
  const session = await requireSession();
  return { ok: true, ...(await listTrash(session.userId)) };
}

export async function restoreItemAction(itemId: number): Promise<ActionResult> {
  const session = await requireSession();
  if (!(await restoreItem(session.userId, itemId))) {
    return { ok: false, error: "Item not found in trash" };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function deleteItemForeverAction(itemId: number): Promise<ActionResult> {
  const session = await requireSession();
  await deleteItemForever(session.userId, itemId);
  return { ok: true };
}

export async function emptyTrashAction(): Promise<ActionResult> {
  const session = await requireSession();
  await emptyTrash(session.userId);
  revalidatePath("/");
  return { ok: true };
}
