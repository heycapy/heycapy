import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ItemDetails } from "@/components/buckets/ItemDetails";

afterEach(cleanup);

const base = {
  dateSlot: <span>date</span>,
  allDay: false,
  withStatus: false,
  status: "active",
  statuses: [{ name: "active", color: "#22c55e" }],
  bucketReminders: [0],
  onStatusChange: vi.fn(),
  onRecurringChange: vi.fn(),
  onRemindersChange: vi.fn(),
};

function chip(name: RegExp) {
  return screen.getByRole("button", { name });
}

it("names each chip by what it holds, and only the empty ones by their kind", () => {
  render(<ItemDetails {...base} datePart="2031-03-09" />);
  expect(chip(/^repeat/).getAttribute("aria-label")).toBe("repeat");
  expect(chip(/^reminders/).getAttribute("aria-label")).toBe("reminders: at time");
});

it("opens one editor at a time", () => {
  render(<ItemDetails {...base} datePart="2031-03-09" />);
  fireEvent.click(chip(/^repeat/));
  expect(chip(/^repeat/).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(chip(/^reminders/));
  expect(chip(/^repeat/).getAttribute("aria-expanded")).toBe("false");
  expect(chip(/^reminders/).getAttribute("aria-expanded")).toBe("true");
});

it("keeps repeat and reminders shut until there is a date", () => {
  render(<ItemDetails {...base} datePart="" />);
  const described = chip(/^repeat/).getAttribute("aria-describedby") ?? "";
  expect(document.getElementById(described)?.textContent).toBe("pick a date first");
  fireEvent.click(chip(/^repeat/));
  expect(chip(/^repeat/).getAttribute("aria-expanded")).toBe("false");
});
