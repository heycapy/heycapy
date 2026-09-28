import { describe, expect, it } from "vitest";
import { servedOverHttps } from "@/lib/auth/https";

describe("servedOverHttps", () => {
  it("is true behind a proxy that ended https", () => {
    expect(servedOverHttps(new Headers({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(servedOverHttps(new Headers({ "x-forwarded-proto": "HTTPS, http" }))).toBe(true);
  });

  it("is false for plain http, or when nothing says otherwise", () => {
    expect(servedOverHttps(new Headers({ "x-forwarded-proto": "http" }))).toBe(false);
    expect(servedOverHttps(new Headers())).toBe(false);
  });
});
