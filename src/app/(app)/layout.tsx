import { redirect } from "next/navigation";
import { eq, isNull, or } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { AppShell } from "@/components/layout/AppShell";
import { CreateBucketModal } from "@/components/buckets/CreateBucketModal";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const templateList = await db
    .select()
    .from(templates)
    .where(or(isNull(templates.userId), eq(templates.userId, session.userId)));

  return (
    <div className="flex h-full flex-col">
      <AppShell>{children}</AppShell>
      <CreateBucketModal templates={templateList} />
    </div>
  );
}
