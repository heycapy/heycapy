import { redirect } from "next/navigation";
import { eq, isNull, or } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { templates, users } from "@/lib/db/schema";
import { AppShell } from "@/components/layout/AppShell";
import { getChannelFailures } from "@/lib/notifications/failures";
import { getWorkingChannels } from "@/lib/notifications/channels";
import { CreateBucketModal } from "@/components/buckets/CreateBucketModal";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rawTemplates, user, failures, workingChannels] = await Promise.all([
    db
      .select()
      .from(templates)
      .where(or(isNull(templates.userId), eq(templates.userId, session.userId))),
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    getChannelFailures(session.userId),
    getWorkingChannels(session.userId),
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
        failures={failures}
        hasWorkingChannel={workingChannels.length > 0}
      >
        {children}
      </AppShell>
      <CreateBucketModal templates={templateList} />
    </div>
  );
}
