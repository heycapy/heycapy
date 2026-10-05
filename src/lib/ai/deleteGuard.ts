import { DELETE_CONFIRM_TTL_MS } from "@/constants";

type Pending = { turnId: number; expiresAt: number };

// lost on restart, which only means capy asks again
const pending = new Map<string, Pending>();

let lastTurnId = 0;

export function nextTurnId(): number {
  return ++lastTurnId;
}

export function confirmDelete(userId: number, bucketId: number, turnId: number): boolean {
  const key = `${userId}:${bucketId}`;
  const found = pending.get(key);
  if (found && found.expiresAt > Date.now() && found.turnId !== turnId) {
    pending.delete(key);
    return true;
  }
  pending.set(key, { turnId, expiresAt: Date.now() + DELETE_CONFIRM_TTL_MS });
  return false;
}
