import { afterEach, expect, it, vi } from "vitest";
import { withTimeout } from "@/lib/async";

afterEach(() => vi.useRealTimers());

it("passes the result through when the work finishes in time", async () => {
  await expect(withTimeout(Promise.resolve(42), 1000, "work")).resolves.toBe(42);
});

it("rejects with a clear message once the deadline passes", async () => {
  vi.useFakeTimers();
  const pending = withTimeout(new Promise(() => {}), 30_000, "telegram delivery");
  const check = expect(pending).rejects.toThrow("telegram delivery timed out after 30s");
  await vi.advanceTimersByTimeAsync(30_000);
  await check;
});
