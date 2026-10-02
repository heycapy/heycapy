import { LAST_DAY_OF_MONTH, WEEKDAY_NAMES } from "@/constants";
import { RecurringConfig } from "@/types/rules";

const REPEAT_ARGS = [
  "recurring_frequency",
  "recurring_interval",
  "recurring_end_date",
  "recurring_weekdays",
  "recurring_last_day_of_month",
];

export type RepeatChange =
  | { kind: "none" }
  | { kind: "clear" }
  | { kind: "set"; config: RecurringConfig }
  | { kind: "error"; error: string };

function weekdayIndex(name: unknown): number {
  return (WEEKDAY_NAMES as readonly string[]).indexOf(
    String(name).trim().toLowerCase().slice(0, 3)
  );
}

// Arguments left out keep the saved repeat's value; a new frequency drops its weekdays and day of month
export function repeatFromArgs(
  args: Record<string, unknown>,
  saved: RecurringConfig | null
): RepeatChange {
  if (args.clear_recurring === true) return { kind: "clear" };
  if (!REPEAT_ARGS.some((key) => key in args && args[key] !== undefined)) return { kind: "none" };

  const frequency = args.recurring_frequency ?? saved?.frequency;
  if (!frequency) {
    return { kind: "error", error: "Set recurring_frequency to make the item repeat" };
  }
  const sameFrequency = saved?.frequency === frequency;

  let weekdays = sameFrequency ? saved?.weekdays : undefined;
  if ("recurring_weekdays" in args) {
    const names = Array.isArray(args.recurring_weekdays) ? args.recurring_weekdays : [];
    if (names.length > 0 && frequency !== "weekly") {
      return { kind: "error", error: "recurring_weekdays only works with a weekly repeat" };
    }
    const days = names.map(weekdayIndex);
    if (days.includes(-1)) {
      return { kind: "error", error: `Weekdays must be among: ${WEEKDAY_NAMES.join(", ")}` };
    }
    weekdays = days.length > 0 ? [...new Set(days)].sort((a, b) => a - b) : undefined;
  }

  let anchorDay = sameFrequency ? saved?.anchorDay : undefined;
  if ("recurring_last_day_of_month" in args) {
    if (args.recurring_last_day_of_month === true) {
      if (frequency !== "monthly") {
        return {
          kind: "error",
          error: "recurring_last_day_of_month only works with a monthly repeat",
        };
      }
      anchorDay = LAST_DAY_OF_MONTH;
    } else if (anchorDay === LAST_DAY_OF_MONTH) {
      anchorDay = undefined;
    }
  }

  const parsed = RecurringConfig.safeParse({
    enabled: true,
    frequency,
    interval: args.recurring_interval ?? saved?.interval ?? 1,
    endDate:
      "recurring_end_date" in args ? (args.recurring_end_date ?? null) : (saved?.endDate ?? null),
    anchorDay,
    weekdays,
  });
  if (!parsed.success) {
    return {
      kind: "error",
      error: `Invalid repeat: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
    };
  }
  return { kind: "set", config: parsed.data };
}
