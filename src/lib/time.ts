export type Ampm = "am" | "pm";

export function toH24(h12: number, ampm: Ampm): number {
  if (ampm === "am") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

export function toH12(h24: number): { hour: string; ampm: Ampm } {
  const isPm = h24 >= 12;
  const h = isPm ? (h24 === 12 ? 12 : h24 - 12) : h24 === 0 ? 12 : h24;
  return { hour: String(h), ampm: isPm ? "pm" : "am" };
}

export function deadlineDate(deadline: string): string {
  if (!deadline.includes("T")) return deadline;
  const d = new Date(deadline);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildDeadline(date: string, hour: string, min: string, ampm: Ampm): string {
  if (!date) return "";
  const h = parseInt(hour, 10);
  if (!hour.trim() || !Number.isFinite(h)) return date;
  const local = `${date}T${String(toH24(h, ampm)).padStart(2, "0")}:${min.padStart(2, "0")}:00`;
  const d = new Date(local);
  return isNaN(d.getTime()) ? date : d.toISOString();
}

export function defaultTimeFor(
  date: string,
  now = new Date()
): { hour: string; min: string; ampm: Ampm } {
  const nineAm = { hour: "9", min: "00", ampm: "am" as Ampm };
  if (date !== deadlineDate(now.toISOString()) || now.getHours() < 9) return nineAm;
  const next = (Math.floor((now.getHours() * 60 + now.getMinutes()) / 30) + 1) * 30;
  if (next >= 24 * 60) return { ...nineAm, hour: "" };
  const { hour, ampm } = toH12(Math.floor(next / 60));
  return { hour, min: String(next % 60).padStart(2, "0"), ampm };
}

export function lastDayOfMonth(date: string): string {
  const [year = 0, month = 1] = date.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
