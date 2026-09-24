type Unit = "hours" | "days" | "weeks" | "months";

const UNIT_MAP: Record<string, Unit> = {};
(["h", "hr", "hrs", "hour", "hours"] as const).forEach((u) => (UNIT_MAP[u] = "hours"));
(["d", "day", "days"] as const).forEach((u) => (UNIT_MAP[u] = "days"));
(["w", "wk", "wks", "week", "weeks"] as const).forEach((u) => (UNIT_MAP[u] = "weeks"));
(["m", "mo", "mos", "mon", "mth", "mths", "month", "months"] as const).forEach(
  (u) => (UNIT_MAP[u] = "months")
);

function parse(str: string): { value: number; unit: Unit } | null {
  const s = str.toLowerCase().trim().replace(/\s+/g, " ");
  const match = s.match(/^(\d+)\s*([a-z]+)$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = UNIT_MAP[match[2]];
  if (!unit || value <= 0) return null;
  return { value, unit };
}

function apply(value: number, unit: Unit, from: Date): Date {
  const d = new Date(from);
  if (unit === "hours") d.setHours(d.getHours() + value);
  if (unit === "days") d.setDate(d.getDate() + value);
  if (unit === "weeks") d.setDate(d.getDate() + value * 7);
  if (unit === "months") d.setMonth(d.getMonth() + value);
  return d;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns a YYYY-MM-DD string offset from today, or null if unparseable. */
export function parseDurationToDate(str: string | null | undefined): string | null {
  if (!str?.trim()) return null;
  const parsed = parse(str);
  if (!parsed) return null;
  return toDateStr(apply(parsed.value, parsed.unit, new Date()));
}

/** Returns the number of minutes represented by a duration string, or null if unparseable. */
export function parseDurationToMins(str: string | null | undefined): number | null {
  if (!str?.trim()) return null;
  const parsed = parse(str);
  if (!parsed) return null;
  if (parsed.unit === "hours") return parsed.value * 60;
  if (parsed.unit === "days") return parsed.value * 24 * 60;
  if (parsed.unit === "weeks") return parsed.value * 7 * 24 * 60;
  if (parsed.unit === "months") return parsed.value * 30 * 24 * 60;
  return null;
}

/** Returns a display string for a number of minutes, e.g. 4320 → "3 days". */
export function minsToDisplayStr(mins: number): string {
  if (mins <= 0) return "";
  const MONTH = 30 * 24 * 60;
  const WEEK = 7 * 24 * 60;
  const DAY = 24 * 60;
  if (mins % MONTH === 0) return `${mins / MONTH} months`;
  if (mins % WEEK === 0) return `${mins / WEEK} weeks`;
  if (mins % DAY === 0) return `${mins / DAY} days`;
  if (mins % 60 === 0) return `${mins / 60} hours`;
  return `${mins} minutes`;
}

/** Returns the number of days represented by a duration string, or null if unparseable. */
export function parseDurationToDays(str: string | null | undefined): number | null {
  if (!str?.trim()) return null;
  const parsed = parse(str);
  if (!parsed) return null;
  if (parsed.unit === "hours") return null;
  if (parsed.unit === "days") return parsed.value;
  if (parsed.unit === "weeks") return parsed.value * 7;
  if (parsed.unit === "months") return parsed.value * 30;
  return null;
}

/** Returns a display string for a number of days, e.g. 14 → "2 weeks". */
export function daysToDisplayStr(days: number): string {
  if (days <= 0) return "";
  if (days % 30 === 0) return `${days / 30} months`;
  if (days % 7 === 0) return `${days / 7} weeks`;
  return `${days} days`;
}

/**
 * Returns a short preview string for display below the input.
 * e.g. "→ Oct 3"  or  "unrecognized format"
 */
export function durationPreview(str: string): { text: string; valid: boolean } {
  if (!str.trim()) return { text: "", valid: true };
  const parsed = parse(str);
  if (!parsed) return { text: "unrecognized format", valid: false };
  const date = apply(parsed.value, parsed.unit, new Date());
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { text: `→ ${label}`, valid: true };
}
