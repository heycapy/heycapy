import { fromLocal, toLocal } from "@/lib/reminders/zoned";

export function postponeDeadline(deadline: Date, days: number, now: Date, timezone: string): Date {
  const base = toLocal(deadline > now ? deadline : now, timezone);
  const time = toLocal(deadline, timezone);
  return fromLocal(
    {
      year: base.year,
      month: base.month,
      day: base.day + days,
      hour: time.hour,
      minute: time.minute,
    },
    timezone
  );
}
