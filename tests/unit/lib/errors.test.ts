import { describe, it, expect } from "vitest";
import { errorMessage, parseProviderError } from "@/lib/errors";

describe("errorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(errorMessage(new Error("something went wrong"))).toBe("something went wrong");
  });

  it("stringifies a plain string", () => {
    expect(errorMessage("network timeout")).toBe("network timeout");
  });

  it("stringifies a number", () => {
    expect(errorMessage(42)).toBe("42");
  });

  it("stringifies null", () => {
    expect(errorMessage(null)).toBe("null");
  });

  it("stringifies undefined", () => {
    expect(errorMessage(undefined)).toBe("undefined");
  });

  it("stringifies a plain object", () => {
    expect(errorMessage({ code: 500 })).toBe("[object Object]");
  });
});

describe("parseProviderError", () => {
  it("falls back to raw message when no JSON error body present", () => {
    expect(parseProviderError(new Error("network timeout"))).toBe("network timeout");
  });

  it("extracts nested error.message from provider JSON format", () => {
    const raw = `request failed [{"error":{"message":"rate limit exceeded"}}]`;
    expect(parseProviderError(new Error(raw))).toBe("rate limit exceeded");
  });

  it("falls back when JSON is malformed", () => {
    const raw = `request failed [not json at all]`;
    expect(parseProviderError(new Error(raw))).toBe(raw);
  });

  it("falls back when error key is missing in parsed JSON", () => {
    const raw = `request failed [{"status":429}]`;
    expect(parseProviderError(new Error(raw))).toBe(raw);
  });

  it("falls back when error.message is missing", () => {
    const raw = `request failed [{"error":{}}]`;
    expect(parseProviderError(new Error(raw))).toBe(raw);
  });

  it("handles non-Error input", () => {
    expect(parseProviderError("plain string error")).toBe("plain string error");
  });
});
