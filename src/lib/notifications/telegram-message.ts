import { formatDeadline, formatWhen } from "@/lib/format-date";
import type { Due } from "@/lib/items/deadline";
import { overdueFrom } from "@/lib/reminders/zoned";

export type ItemAlert = {
  kind: "reminder" | "overdue";
  title: string;
  deadline: Date;
  deadlineTimezone?: string | null;
  bucketName: string | null;
  note: string | null;
};

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function itemAlertHtml(alert: ItemAlert, now: Date, timezone: string): string {
  const when = formatDeadline(alert.deadline, alert.deadlineTimezone, now, timezone);
  const bucket = alert.bucketName ? ` · ${escapeHtml(alert.bucketName)}` : "";
  const lines =
    alert.kind === "overdue" ||
    overdueFrom(alert.deadline, alert.deadlineTimezone ?? timezone, timezone) < now
      ? [`🔴 <b>${escapeHtml(alert.title)}</b>`, `overdue · was due ${when}${bucket}`]
      : [`⏰ <b>${escapeHtml(alert.title)}</b>`, `due ${when}${bucket}`];
  if (alert.note) lines.push("", `<i>${escapeHtml(alert.note)}</i>`);
  return lines.join("\n");
}

export function itemDoneHtml(title: string, alreadyDone: boolean): string {
  return `✓ <s>${escapeHtml(title)}</s>\n${alreadyDone ? "already done" : "done"}`;
}

export function itemMovedHtml(
  title: string,
  moved: Due & { deadline: Date },
  next: (Due & { deadline: Date }) | null,
  now: Date,
  timezone: string
): string {
  const when = (d: Due & { deadline: Date }) =>
    formatDeadline(d.deadline, d.deadlineTimezone, now, timezone);
  const line = `📅 <b>${escapeHtml(title)}</b>\nmoved to ${when(moved)}`;
  return next ? `${line}\n↺ next one stays ${when(next)}` : line;
}

export function remindAgainHtml(title: string, at: Date, now: Date, timezone: string): string {
  return `⏰ <b>${escapeHtml(title)}</b>\nI'll remind you again ${formatWhen(at, now, timezone)}`;
}

export function itemMissedHtml(title: string): string {
  return `⏭ <b>${escapeHtml(title)}</b>\nmissed — the next one is on its way`;
}
