"use server";

import { verifyReminderAction } from "@/lib/reminders/action-token";
import { applyReminderAction, type ReminderActionOutcome } from "@/lib/reminders/quick-actions";
import { recordSystemError } from "@/lib/system-errors";
import { errorMessage } from "@/lib/errors";

export async function confirmReminderAction(token: string): Promise<ReminderActionOutcome> {
  const claim = verifyReminderAction(token);
  if (!claim) return { ok: false, message: "this link has expired — open heycapy instead" };
  try {
    return await applyReminderAction(claim);
  } catch (err) {
    recordSystemError(
      "reminder-action",
      `${claim.action} from email failed: ${errorMessage(err)}`,
      {
        err,
        userId: claim.userId,
        context: { itemId: claim.itemId, action: claim.action },
      }
    );
    return { ok: false, message: "something went wrong — try again from heycapy" };
  }
}
