import { notify } from "@/components/ui/notify";
import { ITEM_STATUS } from "@/constants";
import { UNDO_TICK_MS } from "./constants";

type Ticked = { title: string; status: string; recurring: string | null };

// A repeating item has already made its next date by now, so reopening it would leave two
export function offerUndoTick(item: Ticked, undo: () => Promise<boolean>) {
  notify.info(`done "${item.title}"`, {
    countdown: !item.recurring,
    duration: UNDO_TICK_MS,
    action: item.recurring ? undefined : { label: "undo", onClick: () => void undo() },
  });
}

export function isTick(item: { status: string }, status: string) {
  return status === ITEM_STATUS.completed && item.status !== ITEM_STATUS.completed;
}
