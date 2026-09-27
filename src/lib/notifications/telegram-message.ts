import { toLocal } from "@/lib/reminders/zoned";
import { RELATIVE_DAY_NAMES } from "./constants";

export type ItemAlert = {
  kind: "reminder" | "overdue";
  title: string;
  deadline: Date;
  bucketName: string | null;
  note: string | null;
};

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function localDayNumber(date: Date, timezone: string): number {
  const l = toLocal(date, timezone);
  return Date.UTC(l.year, l.month - 1, l.day) / 86_400_000;
}

export function formatWhen(date: Date, now: Date, timezone: string): string {
  const local = toLocal(date, timezone);
  const dayDiff = localDayNumber(date, timezone) - localDayNumber(now, timezone);
  const day =
    RELATIVE_DAY_NAMES[dayDiff] ??
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(local.year !== toLocal(now, timezone).year && { year: "numeric" }),
    }).format(date);
  if (local.hour === 0 && local.minute === 0) return day;
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day}, ${time}`;
}

export function itemAlertHtml(alert: ItemAlert, now: Date, timezone: string): string {
  const when = formatWhen(alert.deadline, now, timezone);
  const bucket = alert.bucketName ? ` · ${escapeHtml(alert.bucketName)}` : "";
  const lines =
    alert.kind === "overdue"
      ? [`🔴 <b>${escapeHtml(alert.title)}</b>`, `overdue · was due ${when}${bucket}`]
      : [`⏰ <b>${escapeHtml(alert.title)}</b>`, `due ${when}${bucket}`];
  if (alert.note) lines.push("", `<i>${escapeHtml(alert.note)}</i>`);
  return lines.join("\n");
}

export function itemDoneHtml(title: string, alreadyDone: boolean): string {
  return `✓ <s>${escapeHtml(title)}</s>\n${alreadyDone ? "already done" : "done"}`;
}

export function itemMovedHtml(title: string, deadline: Date, now: Date, timezone: string): string {
  return `📅 <b>${escapeHtml(title)}</b>\nmoved to ${formatWhen(deadline, now, timezone)}`;
}
