"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/types/result";
import { requireSession } from "./action-helpers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendFeedback, sendFeedbackThanks } from "@/lib/feedback";
import { memberName } from "@/lib/buckets/member-name";
import { recordSystemError } from "@/lib/system-errors";
import { FEEDBACK_MAX_LENGTH, FEEDBACK_PAGE_MAX_LENGTH } from "@/constants";
import packageJson from "../../../package.json";

const FeedbackInput = z.object({
  message: z.string().trim().min(1, "Write something first").max(FEEDBACK_MAX_LENGTH),
  page: z.string().max(FEEDBACK_PAGE_MAX_LENGTH),
});

const SEND_FAILED = "Couldn't send it. Try again in a moment.";

export async function sendFeedbackAction(message: string, page: string): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = FeedbackInput.safeParse({ message, page });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { email: true, username: true, displayName: true },
  });
  if (!user) return { ok: false, error: SEND_FAILED };

  const browser = (await headers()).get("user-agent") ?? "unknown";
  const build = process.env.NEXT_DEPLOYMENT_ID ?? "local";
  const text = [
    parsed.data.message,
    "",
    `— ${memberName(user)} (${user.email})`,
    `page: ${parsed.data.page}`,
    `version: ${packageJson.version} · build ${build}`,
    `browser: ${browser}`,
  ].join("\n");

  try {
    const result = await sendFeedback({ text, replyTo: user.email });
    if (result.ok) {
      await sendFeedbackThanks(user.email, parsed.data.message, session.userId);
      return { ok: true };
    }
    if (result.reason === "not_configured") {
      return { ok: false, error: "Feedback isn't set up on this server" };
    }
    recordSystemError("feedback", result.error ?? "send failed", { userId: session.userId });
  } catch (err) {
    recordSystemError("feedback", "send threw", { userId: session.userId, err });
  }
  return { ok: false, error: SEND_FAILED };
}
