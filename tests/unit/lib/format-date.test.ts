import { describe, it, expect } from "vitest";
import { formatDeadline } from "@/lib/format-date";

const INDIA = "Asia/Kolkata";
const LONDON = "Europe/London";
const NOW = new Date("2026-10-10T12:00:00Z");

describe("formatDeadline", () => {
  it("shows an all-day item on its own date to someone on another clock", () => {
    const oct12India = new Date("2026-10-11T18:30:00Z");
    expect(formatDeadline(oct12India, INDIA, NOW, LONDON)).toBe("Mon, Oct 12");
    expect(formatDeadline(oct12India, INDIA, NOW, INDIA)).toBe("Mon, Oct 12");
  });

  it("shows the time of an item that only lands on midnight on the viewer's clock", () => {
    const halfPastFourIndia = new Date("2026-10-12T23:00:00Z");
    expect(formatDeadline(halfPastFourIndia, INDIA, NOW, LONDON)).toBe("Tue, Oct 13, 12:00 AM");
  });

  it("reads the date on the viewer's clock when the item has none saved", () => {
    expect(formatDeadline(new Date("2026-10-11T23:00:00Z"), null, NOW, LONDON)).toBe("Mon, Oct 12");
  });
});
