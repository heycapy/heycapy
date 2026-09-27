import { RecurringConfig } from "@/types/rules";

export function parseRecurring(raw: string | null): RecurringConfig | null {
  if (!raw) return null;
  try {
    return RecurringConfig.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function advance(deadline: Date, config: RecurringConfig): Date {
  const next = new Date(deadline);
  const n = config.interval;
  switch (config.frequency) {
    case "daily":
      next.setDate(next.getDate() + n);
      break;
    case "weekly":
      next.setDate(next.getDate() + n * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + n);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + n);
      break;
  }
  return next;
}

// Skips past dates; null once the series has ended
export function nextOccurrenceDate(
  deadline: Date,
  config: RecurringConfig,
  now = new Date()
): Date | null {
  if (!config.enabled) return null;
  let next = advance(deadline, config);
  while (next <= now) next = advance(next, config);
  return config.endDate && next > new Date(config.endDate) ? null : next;
}
