import { browserTimezone } from "@/lib/time";
import { resolveDeadline } from "@/lib/items/deadline";
import type { ItemPatch } from "@/lib/items/edit-draft";
import type { ListItem } from "@/lib/reminders/status";

// The item as the list shows it once a save lands, until the server's copy replaces it
export function withPatch(item: ListItem, patch: ItemPatch): ListItem {
  const next = { ...item };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.deadline !== undefined) {
    const saved = item.deadline
      ? { deadline: item.deadline, deadlineTimezone: item.deadlineTimezone }
      : undefined;
    const due = resolveDeadline(patch.deadline, patch.clock ?? browserTimezone(), saved);
    next.deadline = due.deadline;
    next.deadlineTimezone = due.deadlineTimezone;
  }
  if (patch.recurring !== undefined) {
    next.recurring = patch.recurring?.enabled ? JSON.stringify(patch.recurring) : null;
  }
  return next;
}
