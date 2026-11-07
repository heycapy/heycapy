import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ItemDetails } from "@/components/buckets/ItemDetails";

afterEach(cleanup);

const base = {
  allDay: false,
  time: { hour: "9", min: "00", ampm: "am" as const },
  withStatus: false,
  status: "active",
  statuses: [{ name: "active", color: "#22c55e" }],
  bucketReminders: [0],
  showMore: false,
  onDateChange: vi.fn(),
  onTimeChange: vi.fn(),
  onStatusChange: vi.fn(),
  onRecurringChange: vi.fn(),
  onRemindersChange: vi.fn(),
};

function chip(name: RegExp) {
  return screen.getByRole("button", { name });
}

it("names each chip by what it holds, and only the empty ones by their kind", () => {
  render(<ItemDetails {...base} datePart="2031-03-09" />);
  expect(chip(/^date/).getAttribute("aria-label")).toBe("date: Mar 9 · 9 am");
  expect(chip(/^repeat/).getAttribute("aria-label")).toBe("repeat");
  expect(chip(/^reminders/).getAttribute("aria-label")).toBe("reminders: at time");
});

it("opens one editor at a time, and the date first when repeat or reminders need one", () => {
  render(<ItemDetails {...base} datePart="" />);
  fireEvent.click(chip(/^repeat/));
  expect(chip(/^date/).getAttribute("aria-expanded")).toBe("true");
  expect(chip(/^repeat/).getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(chip(/^date/));
  expect(chip(/^date/).getAttribute("aria-expanded")).toBe("false");
});

it("keeps required fields in view instead of behind more", () => {
  const { rerender } = render(<ItemDetails {...base} datePart="" more={<p>custom fields</p>} />);
  expect(screen.queryByText("custom fields")).toBeNull();
  fireEvent.click(chip(/^more/));
  expect(screen.getByText("custom fields")).toBeTruthy();

  rerender(<ItemDetails {...base} datePart="" more={<p>custom fields</p>} showMore />);
  expect(screen.queryByRole("button", { name: /^more/ })).toBeNull();
  expect(screen.getByText("custom fields")).toBeTruthy();
});
