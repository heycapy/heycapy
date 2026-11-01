import { afterEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { GET } from "@/app/api/health/route";

afterEach(() => vi.restoreAllMocks());

it("a failing database check says only that it failed, the details go to the server log", async () => {
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  vi.spyOn(db, "get").mockImplementation(() => {
    throw new Error("SQLITE_CANTOPEN: unable to open database file /data/heycapy.db");
  });

  const res = await GET();

  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ status: "error" });
  expect(stderr).toHaveBeenCalledWith(
    expect.stringContaining("[health] error: database check failed: SQLITE_CANTOPEN")
  );
});
