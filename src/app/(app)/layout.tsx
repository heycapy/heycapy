import { redirect } from "next/navigation";
import { eq, isNull, or } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { templates, userSettings, users } from "@/lib/db/schema";
import { AppShell } from "@/components/layout/AppShell";
import { getChannelFailures } from "@/lib/notifications/failures";
import { getChannelSettings, workingChannels } from "@/lib/notifications/channels";
import { CreateBucketModal } from "@/components/buckets/CreateBucketModal";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rawTemplates, user, failures, channelSettings, settings] = await Promise.all([
    db
      .select()
      .from(templates)
      .where(or(isNull(templates.userId), eq(templates.userId, session.userId))),
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    getChannelFailures(session.userId),
    getChannelSettings(session.userId),
    db.query.userSettings.findFirst({
      where: eq(userSettings.userId, session.userId),
      columns: { personalityName: true },
    }),
  ]);

  const seen = new Set<string>();
  const templateList = rawTemplates.filter((t) => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      <AppShell
        email={user?.email ?? ""}
        assistantName={settings?.personalityName ?? "capy"}
        failures={failures}
        hasWorkingChannel={
          !!channelSettings &&
          (workingChannels(channelSettings).length > 0 || channelSettings.webhooks.length > 0)
        }
      >
        {children}
      </AppShell>
      <CreateBucketModal templates={templateList} />
    </div>
  );
}
