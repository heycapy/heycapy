import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/session";

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
