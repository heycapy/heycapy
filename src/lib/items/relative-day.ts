const DAY_MS = 24 * 60 * 60 * 1000;

export function daysFromToday(deadline: Date, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  return Math.round((day.getTime() - today.getTime()) / DAY_MS);
}

export function relativeTime(deadline: Date, now = new Date()): string {
  const diffDays = daysFromToday(deadline, now);
  if (diffDays < 0) return "overdue";
  const allDay = deadline.getHours() === 0 && deadline.getMinutes() === 0;
  if (diffDays === 0) return !allDay && deadline < now ? "overdue" : "today";
  return `${diffDays}d`;
}
