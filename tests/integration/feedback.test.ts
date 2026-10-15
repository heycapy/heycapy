import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemErrors, users } from "@/lib/db/schema";
import { sendFeedbackAction } from "@/app/(app)/feedback-actions";
import { POST } from "@/app/api/feedback/route";
import { resetFeedbackLimits } from "@/lib/feedback";
import {
  APP_NAME,
  FEEDBACK_EMAIL_MAX_LENGTH,
  FEEDBACK_LIMIT_PER_IP,
  FEEDBACK_LIMIT_PER_USER,
  FEEDBACK_LIMIT_SITE_TOTAL,
  FEEDBACK_LIMIT_WINDOW_MS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_SUBJECT,
} from "@/constants";
import { seedUser } from "./helpers";

type SentEmail = { to: string; subject: string; text: string; html?: string; replyTo?: string };

const send = vi.hoisted(() =>
  vi.fn(async (_email: SentEmail) => ({
    data: { id: "1" },
    error: null as { message: string } | null,
  }))
);
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (Test Browser)" }),
}));

const BROWSER = "Mozilla/5.0 (Test Browser)";
const previous = { resend: process.env.RESEND_API_KEY, feedback: process.env.FEEDBACK_EMAIL };

beforeEach(async () => {
  resetFeedbackLimits();
  process.env.RESEND_API_KEY = "re_test";
  process.env.FEEDBACK_EMAIL = "feedback@heycapy.test";
  session.userId = await seedUser();
  await db
    .update(users)
    .set({ username: `plucky_otter_${session.userId}` })
    .where(eq(users.id, session.userId));
});

afterEach(() => {
  process.env.RESEND_API_KEY = previous.resend;
  process.env.FEEDBACK_EMAIL = previous.feedback;
  send.mockClear();
  vi.restoreAllMocks();
});

async function userEmail(): Promise<string> {
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  return user?.email ?? "";
}

describe("in-app feedback", () => {
  it("emails the feedback address with who sent it, the page, the version and the browser", async () => {
    expect(await sendFeedbackAction("  the trash won't open  ", "/?bucket=3")).toEqual({
      ok: true,
    });

    expect(send).toHaveBeenCalledTimes(2);
    const email = send.mock.calls[0][0];
    expect(email.to).toBe("feedback@heycapy.test");
    expect(email.subject).toBe(FEEDBACK_SUBJECT);
    expect(email.replyTo).toBe(await userEmail());
    expect(email.text.startsWith("the trash won't open\n")).toBe(true);
    expect(email.text).toContain(`— plucky_otter_${session.userId} (${await userEmail()})`);
    expect(email.text).toContain("page: /?bucket=3");
    expect(email.text).toMatch(/version: \d+\.\d+\.\d+ · build /);
    expect(email.text).toContain(`browser: ${BROWSER}`);
  });

  it("thanks the person by email, with what they sent", async () => {
    await sendFeedbackAction("the <b>trash</b> won't open", "/");

    const thanks = send.mock.calls[1][0];
    expect(thanks.to).toBe(await userEmail());
    expect(thanks.subject).toBe(`[${APP_NAME}] capy got your note`);
    expect(thanks.text).toContain("the <b>trash</b> won't open");
    expect(thanks.html).toContain("the &lt;b&gt;trash&lt;/b&gt; won't open");
  });

  it("still counts the feedback as sent when the thank-you email fails", async () => {
    send
      .mockResolvedValueOnce({ data: { id: "1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "2" }, error: { message: "bounced" } });

    expect(await sendFeedbackAction("hello", "/")).toEqual({ ok: true });
    const recorded = await db.query.systemErrors.findFirst({
      where: eq(systemErrors.userId, session.userId),
    });
    expect(recorded?.level).toBe("warning");
    expect(recorded?.message).toBe("thank-you email failed");
  });

  it("refuses an empty or too long message and sends nothing", async () => {
    expect(await sendFeedbackAction("   ", "/")).toEqual({
      ok: false,
      error: "Write something first",
    });
    const tooLong = await sendFeedbackAction("a".repeat(FEEDBACK_MAX_LENGTH + 1), "/");
    expect(tooLong.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("says so when feedback isn't set up on the server", async () => {
    delete process.env.FEEDBACK_EMAIL;
    expect(await sendFeedbackAction("hello", "/")).toEqual({
      ok: false,
      error: "Feedback isn't set up on this server",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("records a failed send and tells the user to try again", async () => {
    send.mockResolvedValueOnce({ data: { id: "1" }, error: { message: "rate limited" } });
    expect(await sendFeedbackAction("hello", "/")).toEqual({
      ok: false,
      error: "Couldn't send it. Try again in a moment.",
    });
    const recorded = await db.query.systemErrors.findFirst({
      where: eq(systemErrors.userId, session.userId),
    });
    expect(recorded?.source).toBe("feedback");
    expect(recorded?.message).toBe("rate limited");
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("feedback limits", () => {
  const TOO_MANY = { ok: false, error: "That's a lot of feedback at once. Try again in an hour." };

  function fromSite(ip: Record<string, string>) {
    return POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ip },
        body: JSON.stringify({ message: "hello" }),
      })
    );
  }

  it("stops a person after a few messages in an hour and sends nothing more", async () => {
    for (let i = 0; i < FEEDBACK_LIMIT_PER_USER; i++) {
      expect(await sendFeedbackAction(`note ${i}`, "/")).toEqual({ ok: true });
    }
    send.mockClear();

    expect(await sendFeedbackAction("one more", "/")).toEqual(TOO_MANY);
    expect(send).not.toHaveBeenCalled();
  });

  it("doesn't count a message that was refused as empty", async () => {
    for (let i = 0; i < FEEDBACK_LIMIT_PER_USER; i++) await sendFeedbackAction("  ", "/");
    expect(await sendFeedbackAction("hello", "/")).toEqual({ ok: true });
  });

  it("lets the person write again once the hour has passed, and never limits someone else", async () => {
    const start = Date.now();
    for (let i = 0; i < FEEDBACK_LIMIT_PER_USER; i++) await sendFeedbackAction("hi", "/");

    const firstUser = session.userId;
    session.userId = await seedUser();
    expect(await sendFeedbackAction("hi", "/")).toEqual({ ok: true });

    session.userId = firstUser;
    vi.spyOn(Date, "now").mockReturnValue(start + FEEDBACK_LIMIT_WINDOW_MS);
    expect(await sendFeedbackAction("hi", "/")).toEqual({ ok: true });
  });

  it("stops one address on the site form without blocking others", async () => {
    const one = { "Fly-Client-IP": "203.0.113.1" };
    for (let i = 0; i < FEEDBACK_LIMIT_PER_IP; i++) {
      expect((await fromSite(one)).status).toBe(200);
    }
    send.mockClear();

    expect((await fromSite(one)).status).toBe(429);
    expect(send).not.toHaveBeenCalled();
    expect((await fromSite({ "Fly-Client-IP": "203.0.113.2" })).status).toBe(200);
  });

  it("trusts Fly's client address over a forwarded one the sender can make up", async () => {
    for (let i = 0; i < FEEDBACK_LIMIT_PER_IP; i++) {
      await fromSite({ "Fly-Client-IP": "203.0.113.1", "X-Forwarded-For": `198.51.100.${i}` });
    }
    const spoofed = { "Fly-Client-IP": "203.0.113.1", "X-Forwarded-For": "198.51.100.99" };
    expect((await fromSite(spoofed)).status).toBe(429);
  });

  it("caps the site form as a whole, so changing addresses doesn't get around it", async () => {
    for (let i = 0; i < FEEDBACK_LIMIT_SITE_TOTAL; i++) {
      expect((await fromSite({ "Fly-Client-IP": `203.0.113.${i}` })).status).toBe(200);
    }
    expect((await fromSite({ "Fly-Client-IP": "192.0.2.1" })).status).toBe(429);
  });

  it("doesn't let a blocked address use up the site form for everyone else", async () => {
    const blocked = { "Fly-Client-IP": "203.0.113.1" };
    for (let i = 0; i < FEEDBACK_LIMIT_SITE_TOTAL; i++) await fromSite(blocked);
    expect((await fromSite({ "Fly-Client-IP": "203.0.113.2" })).status).toBe(200);
  });

  it("keeps the site form and the app apart", async () => {
    for (let i = 0; i < FEEDBACK_LIMIT_SITE_TOTAL; i++) {
      await fromSite({ "Fly-Client-IP": `203.0.113.${i}` });
    }
    expect(await sendFeedbackAction("hello", "/")).toEqual({ ok: true });
  });
});

describe("site feedback form", () => {
  function postBody(body: string) {
    return POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
    );
  }

  it("sends the message with the email the person left", async () => {
    const res = await postBody(JSON.stringify({ message: "  love it  ", email: " a@b.co " }));
    expect(res.status).toBe(200);
    expect(send.mock.calls[0][0].text).toBe("love it\n\n— a@b.co");
  });

  it("refuses a message longer than the form allows and sends nothing", async () => {
    const res = await postBody(JSON.stringify({ message: "a".repeat(FEEDBACK_MAX_LENGTH + 1) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Message is too long" });
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts a message exactly at the limit", async () => {
    const res = await postBody(JSON.stringify({ message: "a".repeat(FEEDBACK_MAX_LENGTH) }));
    expect(res.status).toBe(200);
  });

  it("refuses an over-long email", async () => {
    const email = `${"a".repeat(FEEDBACK_EMAIL_MAX_LENGTH)}@b.co`;
    const res = await postBody(JSON.stringify({ message: "hi", email }));
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("answers a broken or wrong-shaped body with 400, not a crash", async () => {
    for (const body of ["{not json", "null", JSON.stringify({ message: 42 }), ""]) {
      expect((await postBody(body)).status).toBe(400);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("doesn't count a refused message against the limit", async () => {
    for (let i = 0; i < FEEDBACK_LIMIT_PER_IP; i++) {
      await postBody(JSON.stringify({ message: "a".repeat(FEEDBACK_MAX_LENGTH + 1) }));
    }
    expect((await postBody(JSON.stringify({ message: "hi" }))).status).toBe(200);
  });
});
