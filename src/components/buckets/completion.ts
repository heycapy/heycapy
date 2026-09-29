import { ITEM_STATUS } from "@/constants";
import type { StatusDef } from "@/types/rules";

export function completionToggle(status: string, statuses: StatusDef[]) {
  const done = status === ITEM_STATUS.completed;
  return {
    label: done ? "reopen" : "done",
    next: done
      ? (statuses.find((s) => s.isDefault)?.name ?? ITEM_STATUS.active)
      : ITEM_STATUS.completed,
  };
}
