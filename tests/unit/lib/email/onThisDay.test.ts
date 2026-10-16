import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onThisDay, resetOnThisDayCache } from "@/lib/email/onThisDay";
import { buildOtpEmail } from "@/lib/auth/otpEmail";
import { ON_THIS_DAY_API_BASE } from "@/constants";

const BALLOON = {
  text: "Felix Baumgartner jumped from a helium balloon in the stratosphere.",
  year: 2012,
  pages: [
    { content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Felix_Baumgartner" } } },
  ],
};

const fetchMock = vi.fn();

function answer(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  resetOnThisDayCache();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("on this day", () => {
  it("asks Wikipedia for today's date, saying who is asking", async () => {
    answer({ selected: [BALLOON] });

    expect(await onThisDay(new Date("2026-10-14T23:30:00Z"))).toEqual({
      year: 2012,
      text: BALLOON.text,
      url: "https://en.wikipedia.org/wiki/Felix_Baumgartner",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${ON_THIS_DAY_API_BASE}/10/14`);
    expect(init.headers["User-Agent"]).toMatch(
      /^HeyCapy\/\d+\.\d+\.\d+ \(https:\/\/heycapy\.xyz\)$/
    );
  });

  it("fetches once per day and again the next day", async () => {
    answer({ selected: [BALLOON] });
    await onThisDay(new Date("2026-10-14T08:00:00Z"));
    await onThisDay(new Date("2026-10-14T20:00:00Z"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    answer({ selected: [BALLOON] });
    await onThisDay(new Date("2026-10-15T08:00:00Z"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`${ON_THIS_DAY_API_BASE}/10/15`);
  });

  it("gives nothing when Wikipedia fails, and tries again next time", async () => {
    answer({}, 429);
    expect(await onThisDay(new Date("2026-10-14T08:00:00Z"))).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    expect(await onThisDay(new Date("2026-10-14T08:00:00Z"))).toBeNull();
    answer({ unexpected: true });
    expect(await onThisDay(new Date("2026-10-14T08:00:00Z"))).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps an event without a page, just without a link", async () => {
    answer({ selected: [{ text: "Something happened.", year: 1066 }] });
    expect(await onThisDay(new Date("2026-10-14T08:00:00Z"))).toEqual({
      year: 1066,
      text: "Something happened.",
      url: null,
    });
  });
});

describe("the sign-in email", () => {
  it("ends with the event and a link to read it on Wikipedia", async () => {
    answer({ selected: [BALLOON] });
    const email = await buildOtpEmail("123456");

    expect(email.text).toContain(`on this day in 2012: ${BALLOON.text}`);
    expect(email.text).toContain("(https://en.wikipedia.org/wiki/Felix_Baumgartner)");
    expect(email.html).toContain("[ on this day in 2012 ]");
    expect(email.html).toContain('href="https://en.wikipedia.org/wiki/Felix_Baumgartner"');
    expect(email.html).not.toContain("please check yourself");
  });

  it("leaves the fact out when there is none, and never adds one to account deletion", async () => {
    answer({}, 500);
    const signIn = await buildOtpEmail("123456");
    expect(signIn.html).not.toContain("on this day");

    const deletion = await buildOtpEmail("123456", "delete-account");
    expect(deletion.html).not.toContain("on this day");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
