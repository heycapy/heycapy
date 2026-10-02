import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { runNotifications } from "@/lib/scheduler";
import { resetSchedulerEnvironment, useSchedulerEnvironment } from "./helpers";

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

it("a failing database query is logged, not thrown as an unhandled rejection", async () => {
  vi.spyOn(db, "select").mockImplementation(() => {
    throw new Error("no such column: items.next_reminder_at");
  });

  await expect(runNotifications()).resolves.toBeUndefined();
  expect(process.stderr.write).toHaveBeenCalledWith(
    expect.stringContaining("[scheduler] error: run failed: no such column: items.next_reminder_at")
  );
});
