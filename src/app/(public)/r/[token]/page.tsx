import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { reminderButtonLabel } from "@/lib/notifications/constants";
import { verifyReminderAction, type ReminderAction } from "@/lib/reminders/action-token";
import { publicAppUrl } from "@/lib/app-url";
import { Sprite } from "@/components/capy/Sprite";
import { ConfirmReminderAction } from "./ConfirmReminderAction";

export const metadata: Metadata = {
  title: "reminder | heycapy",
  robots: { index: false, follow: false },
};

function actionLabel(action: ReminderAction): string {
  if (action === "done") return "mark done";
  return action === "tomorrow"
    ? "remind me again tomorrow"
    : `remind me again in ${reminderButtonLabel(action)}`;
}

export default async function ReminderActionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const claim = verifyReminderAction(token);
  const item = claim
    ? await db.query.items.findFirst({
        where: and(
          eq(items.id, claim.itemId),
          eq(items.userId, claim.userId),
          isNull(items.deletedAt)
        ),
        columns: { title: true },
      })
    : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <Sprite id="capy-mascot" size={96} />
          <h1 className="font-pixel text-sm">heycapy</h1>
        </div>
        {!claim ? (
          <p className="text-muted-foreground font-mono text-xs">
            this link has expired — open heycapy instead
          </p>
        ) : !item ? (
          <p className="text-muted-foreground font-mono text-xs">this item no longer exists</p>
        ) : (
          <ConfirmReminderAction
            token={token}
            title={item.title}
            label={actionLabel(claim.action)}
          />
        )}
        <a
          href={publicAppUrl() ?? "/"}
          className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
        >
          <span className="opacity-50">[</span>open heycapy<span className="opacity-50">]</span>
        </a>
      </div>
    </main>
  );
}
