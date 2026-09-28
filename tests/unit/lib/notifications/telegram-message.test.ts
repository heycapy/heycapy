import { describe, expect, it } from "vitest";
import { formatWhen } from "@/lib/format-date";
import { escapeHtml, itemAlertHtml, itemDoneHtml } from "@/lib/notifications/telegram-message";

const NOW = new Date("2026-03-10T12:00:00Z");

describe("formatWhen", () => {
  it("names today, tomorrow and yesterday", () => {
    expect(formatWhen(new Date("2026-03-10T16:30:00Z"), NOW, "UTC")).toBe("today, 4:30 PM");
    expect(formatWhen(new Date("2026-03-11T09:00:00Z"), NOW, "UTC")).toBe("tomorrow, 9:00 AM");
    expect(formatWhen(new Date("2026-03-09T09:00:00Z"), NOW, "UTC")).toBe("yesterday, 9:00 AM");
  });

  it("uses the weekday and date further out, and the year only when it differs", () => {
    expect(formatWhen(new Date("2026-03-13T09:00:00Z"), NOW, "UTC")).toBe("Fri, Mar 13, 9:00 AM");
    expect(formatWhen(new Date("2027-01-04T09:00:00Z"), NOW, "UTC")).toBe(
      "Mon, Jan 4, 2027, 9:00 AM"
    );
  });

  it("leaves out the time for all-day deadlines", () => {
    expect(formatWhen(new Date("2026-03-11T00:00:00Z"), NOW, "UTC")).toBe("tomorrow");
  });

  it("counts days in the user's timezone", () => {
    // 01:30 on Mar 11 in Kolkata is still Mar 10 in UTC
    expect(formatWhen(new Date("2026-03-10T20:00:00Z"), NOW, "Asia/Kolkata")).toBe(
      "tomorrow, 1:30 AM"
    );
  });
});

describe("itemAlertHtml", () => {
  const alert = {
    kind: "reminder" as const,
    title: "Pay the electricity bill for the apartment on 5th street before the late fee kicks in",
    deadline: new Date("2026-03-10T16:30:00Z"),
    bucketName: "Bills",
    note: null,
  };

  it("shows the full title in bold with the due date and bucket", () => {
    expect(itemAlertHtml(alert, NOW, "UTC")).toBe(
      `⏰ <b>${alert.title}</b>\ndue today, 4:30 PM · Bills`
    );
  });

  it("marks overdue alerts", () => {
    expect(itemAlertHtml({ ...alert, kind: "overdue" }, NOW, "UTC")).toBe(
      `🔴 <b>${alert.title}</b>\noverdue · was due today, 4:30 PM · Bills`
    );
  });

  it("adds the AI note under the title", () => {
    expect(itemAlertHtml({ ...alert, note: "you got this" }, NOW, "UTC")).toMatch(
      /\n\n<i>you got this<\/i>$/
    );
  });

  it("escapes user text so it can't break the formatting", () => {
    const html = itemAlertHtml(
      { ...alert, title: "<b>fix</b> a & b", bucketName: "R&D <team>" },
      NOW,
      "UTC"
    );
    expect(html).toContain("<b>&lt;b&gt;fix&lt;/b&gt; a &amp; b</b>");
    expect(html).toContain("· R&amp;D &lt;team&gt;");
  });
});

describe("itemDoneHtml", () => {
  it("crosses out the title", () => {
    expect(itemDoneHtml("a < b", false)).toBe("✓ <s>a &lt; b</s>\ndone");
    expect(itemDoneHtml("rent", true)).toBe("✓ <s>rent</s>\nalready done");
  });
});

it("escapeHtml leaves plain text alone", () => {
  expect(escapeHtml("renew passport")).toBe("renew passport");
});
