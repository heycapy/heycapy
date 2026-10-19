import { describe, expect, it } from "vitest";
import packageJson from "../../../../package.json";
import { LATEST_RELEASE, RELEASES } from "@/lib/whats-new/constants";

describe("what's new", () => {
  it("its newest release is the version in package.json, so a release can't skip the list", () => {
    expect(LATEST_RELEASE).toBe(packageJson.version);
  });

  it("lists each release once, newest first", () => {
    const versions = RELEASES.map((r) => r.version);
    const byNumber = [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    expect(versions).toEqual(byNumber);
    expect(new Set(versions).size).toBe(versions.length);
  });
});
