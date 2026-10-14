import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemErrors, users } from "@/lib/db/schema";
import { sendFeedbackAction } from "@/app/(app)/feedback-actions";
import { APP_NAME, FEEDBACK_MAX_LENGTH, FEEDBACK_SUBJECT } from "@/constants";
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
