import { describe, expect, it } from "vitest";
import { productionProblems, secretProblems } from "@/lib/startup-checks";

const GOOD = {
  JWT_SECRET: "x".repeat(32),
  ENCRYPTION_KEY: "ab".repeat(32),
};

describe("secretProblems", () => {
  it("accepts a 32 character secret and a 64 character hex key", () => {
    expect(secretProblems(GOOD)).toEqual([]);
    expect(secretProblems({ ...GOOD, ENCRYPTION_KEY: "AB".repeat(32) })).toEqual([]);
  });

  it("refuses missing, empty and example values", () => {
    for (const value of [undefined, "", "change-me-to-a-random-32-char-secret"]) {
      expect(secretProblems({ ...GOOD, JWT_SECRET: value })).toEqual([
        "JWT_SECRET is not set, generate one with: openssl rand -base64 32",
      ]);
    }
    for (const value of [undefined, "", "change-me-to-a-random-64-char-hex-string"]) {
      expect(secretProblems({ ...GOOD, ENCRYPTION_KEY: value })).toEqual([
        "ENCRYPTION_KEY is not set, generate one with: openssl rand -hex 32",
      ]);
    }
  });

  it("refuses a JWT_SECRET shorter than 32 characters", () => {
    expect(secretProblems({ ...GOOD, JWT_SECRET: "x".repeat(31) })).toEqual([
      "JWT_SECRET is 31 characters, it needs at least 32, generate one with: openssl rand -base64 32",
    ]);
  });

  it("refuses an ENCRYPTION_KEY that isn't exactly 64 hex characters", () => {
    for (const value of ["ab".repeat(31), "ab".repeat(33), "zz".repeat(32)]) {
      expect(secretProblems({ ...GOOD, ENCRYPTION_KEY: value })).toHaveLength(1);
    }
  });

  it("lists every problem at once", () => {
    expect(secretProblems({})).toHaveLength(2);
  });
});

describe("productionProblems", () => {
  const LIVE = { APP_URL: "https://heycapy.example.com", RESEND_API_KEY: "re_live" };

  it("accepts a public address with email set up, by resend or smtp", () => {
    expect(productionProblems(LIVE)).toEqual([]);
    expect(productionProblems({ APP_URL: LIVE.APP_URL, SMTP_HOST: "smtp.example.com" })).toEqual(
      []
    );
  });

  it("refuses a missing APP_URL", () => {
    expect(productionProblems({ RESEND_API_KEY: "re_live" })).toEqual([
      expect.stringMatching(/^APP_URL is not set/),
    ]);
  });

  it("refuses a public address without email, where codes on screen would let anyone in", () => {
    expect(productionProblems({ APP_URL: LIVE.APP_URL })).toEqual([
      expect.stringMatching(/^no email is set up/),
    ]);
  });

  it("allows no email when heycapy only runs on this machine", () => {
    expect(productionProblems({ APP_URL: "http://localhost" })).toEqual([]);
    expect(productionProblems({ APP_URL: "http://127.0.0.1:8080" })).toEqual([]);
  });

  it("names every value still copied from .env.example", () => {
    expect(
      productionProblems({
        ...LIVE,
        RESEND_API_KEY: "re_...",
        EMAIL_FROM: "HeyCapy <noreply@yourdomain.com>",
      })
    ).toEqual([
      "RESEND_API_KEY is still the example value from .env.example",
      "EMAIL_FROM is still the example value from .env.example",
    ]);
  });
});
