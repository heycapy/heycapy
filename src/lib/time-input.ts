// Accepts "9 am", "2:30 pm", "14:00", "1430", "9"; returns "HH:MM", "" for empty, null if unreadable
export function parseTimeInput(str: string): string | null {
  const s = str.trim().toLowerCase().replace(/\s+/g, " ").replace(/:$/, "");
  if (!s) return "";
  const pad = (n: number) => String(n).padStart(2, "0");

  const withColon = s.match(/^(\d{1,2}):(\d{2}) ?(am|pm|a|p)?$/);
  if (withColon) {
    let h = parseInt(withColon[1] ?? "", 10);
    const m = parseInt(withColon[2] ?? "", 10);
    const mer = withColon[3]?.[0];
    if (h > 23 || m > 59 || (mer && (h < 1 || h > 12))) return null;
    if (mer === "p" && h < 12) h += 12;
    if (mer === "a" && h === 12) h = 0;
    return `${pad(h)}:${pad(m)}`;
  }

  const withMer = s.match(/^(\d{1,2}) ?(am|pm|a|p)$/);
  if (withMer) {
    let h = parseInt(withMer[1] ?? "", 10);
    const mer = withMer[2]?.[0];
    if (h < 1 || h > 12) return null;
    if (mer === "p" && h < 12) h += 12;
    if (mer === "a" && h === 12) h = 0;
    return `${pad(h)}:00`;
  }

  if (/^\d{4}$/.test(s)) {
    const h = parseInt(s.slice(0, 2), 10);
    const m = parseInt(s.slice(2), 10);
    return h > 23 || m > 59 ? null : `${pad(h)}:${pad(m)}`;
  }

  if (/^\d{1,2}$/.test(s)) {
    const h = parseInt(s, 10);
    return h > 23 ? null : `${pad(h)}:00`;
  }

  return null;
}

// While typing: the colon appears once the hour is complete ("9" → "9:", "10" → "10:"), and a/p adds am/pm
export function formatTypedTime(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (!digits) return "";
  const letter = raw.toLowerCase().match(/[ap](?!.*[ap])/)?.[0];
  const hourLength = digits[0] !== undefined && digits[0] >= "2" ? 1 : 2;
  const hour = digits.slice(0, hourLength);
  if (hour.length < hourLength) return hour;
  const minutes = digits.slice(hourLength, hourLength + 2);
  const meridiem = letter ? ` ${letter}m` : "";
  if (!minutes) return letter ? `${hour}${meridiem}` : `${hour}:`;
  return `${hour}:${minutes}${meridiem}`;
}
