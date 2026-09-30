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

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
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
  if (days % 30 === 0) return plural(days / 30, "month");
  if (days % 7 === 0) return plural(days / 7, "week");
  return plural(days, "day");
}

/**
 * Returns a short preview string for display below the input.
 * e.g. "→ Oct 3"  or  "unrecognized format"
 */
export function durationPreview(str: string): { text: string; valid: boolean } {
  if (!str.trim()) return { text: "", valid: true };
  const parsed = parse(str);
  if (!parsed) return { text: "unrecognized format", valid: false };
  const days = parseDurationToDays(str);
  if (days !== null) {
    if (days === 1) return { text: "→ 1 day from today", valid: true };
    if (days % 30 === 0)
      return { text: `→ ${days / 30} month${days / 30 === 1 ? "" : "s"} from today`, valid: true };
    if (days % 7 === 0)
      return { text: `→ ${days / 7} week${days / 7 === 1 ? "" : "s"} from today`, valid: true };
    return { text: `→ ${days} days from today`, valid: true };
  }
  if (parsed.unit === "hours")
    return { text: `→ ${parsed.value} hour${parsed.value === 1 ? "" : "s"} from now`, valid: true };
  return { text: "unrecognized format", valid: false };
}
