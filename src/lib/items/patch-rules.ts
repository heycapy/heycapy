import type { RecurringConfig } from "@/types/rules";
import { resolveDeadline, type Due } from "./deadline";
import { onLastDayIfAnchored, parseRecurring } from "./occurrence";

// The editor doesn't know the series anchor, keep it while the frequency stays the same
function keepAnchor(config: RecurringConfig, saved: string | null): RecurringConfig {
  if (config.anchorDay) return config;
  const previous = parseRecurring(saved);
  return previous?.frequency === config.frequency && previous.anchorDay
    ? { ...config, anchorDay: previous.anchorDay }
    : config;
}

// The repeat an item has after a patch: `undefined` leaves it, `null` or a disabled one clears it
export function patchedRecurring(
  patch: RecurringConfig | null | undefined,
  saved: string | null
): RecurringConfig | null {
  if (patch === undefined) return parseRecurring(saved);
  return patch?.enabled ? keepAnchor(patch, saved) : null;
}

type SavedDue = Due & { scheduledAt: Date | null };

// The deadline a patch gives an item, read on the setter's clock. Shared by the server and by the
// device, so a change shows the same date before and after it is sent
export function patchedDeadline(
  item: SavedDue,
  value: string | null,
  zone: string,
  recurring: RecurringConfig | null
) {
  const due = resolveDeadline(value, zone, item);
  const keepsMovedDate =
    !!item.scheduledAt && !!recurring && due.deadline?.getTime() === item.deadline?.getTime();
  const deadline =
    due.deadline && due.deadlineTimezone && !keepsMovedDate
      ? onLastDayIfAnchored(due.deadline, recurring, due.deadlineTimezone)
      : due.deadline;
  return { deadline, deadlineTimezone: due.deadlineTimezone, keepsMovedDate };
}
