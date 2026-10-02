import { z } from "zod";
import { verifyReminderAction } from "@/lib/reminders/action-token";
import { applyReminderAction } from "@/lib/reminders/quick-actions";
import { recordSystemError } from "@/lib/system-errors";
import { errorMessage } from "@/lib/errors";

const Body = z.object({ token: z.string().max(1024) });

// buttons on push and ntfy notifications land here; the signed token is the only credential
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const claim = parsed.success ? verifyReminderAction(parsed.data.token) : null;
  if (!claim) {
    return Response.json(
      { ok: false, message: "this button has expired — open heycapy instead" },
      { status: 400 }
    );
  }
  try {
    return Response.json(await applyReminderAction(claim));
  } catch (err) {
    recordSystemError("reminder-action", `${claim.action} failed: ${errorMessage(err)}`, {
      err,
      userId: claim.userId,
      context: { itemId: claim.itemId, action: claim.action },
    });
    return Response.json(
      { ok: false, message: "something went wrong — try again from heycapy" },
      { status: 500 }
    );
  }
}
