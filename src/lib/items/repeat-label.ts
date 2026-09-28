import { LAST_DAY_OF_MONTH, WEEKDAY_NAMES, WORK_WEEK } from "@/constants";
import type { RecurringConfig } from "@/types/rules";

const UNITS: Record<RecurringConfig["frequency"], string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

function pickedDays(config: RecurringConfig): string | null {
  if (config.frequency !== "weekly" || !config.weekdays?.length) return null;
  const days = [...new Set(config.weekdays)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (days.join() === WORK_WEEK.join()) return "weekdays";
  return days.map((d) => WEEKDAY_NAMES[d]).join(", ");
}

function onLastDay(config: RecurringConfig): boolean {
  return config.frequency === "monthly" && config.anchorDay === LAST_DAY_OF_MONTH;
}

export function describeRepeat(config: RecurringConfig): string {
  const n = config.interval;
  const unit = UNITS[config.frequency];
  const every = n === 1 ? `every ${unit}` : `every ${n} ${unit}s`;
  const days = pickedDays(config);
  if (days === "weekdays" && n === 1) return "every weekday";
  if (days) return `${every} on ${days}`;
  if (onLastDay(config)) return `${every} on the last day`;
  return every;
}

export function repeatLabel(config: RecurringConfig): string {
  const days = pickedDays(config);
  if (days) return config.interval === 1 ? days : `${days} · every ${config.interval} weeks`;
  if (onLastDay(config)) return "monthly · last day";
  return config.frequency;
}
