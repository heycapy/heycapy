"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/types/result";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  changeUsername,
  suggestUsername,
  usernameAllowance,
  usernameAvailability,
  type UsernameAllowance,
  type UsernameAvailability,
  type UsernameChangeResult,
} from "@/lib/account/username";
import { USERNAME_INPUT_MAX_LENGTH } from "@/lib/account/constants";

const UsernameInput = z.string().max(USERNAME_INPUT_MAX_LENGTH);

export async function getUsernameAction(): Promise<
  ActionResult<{ username: string | null; allowance: UsernameAllowance }>
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const [user, allowance] = await Promise.all([
    db.query.users.findFirst({ columns: { username: true }, where: eq(users.id, session.userId) }),
    usernameAllowance(session.userId),
  ]);
  if (!allowance) return { ok: false, error: "Unauthorized" };
  return { ok: true, username: user?.username ?? null, allowance };
}

export async function checkUsernameAction(
  name: string
): Promise<ActionResult<{ availability: UsernameAvailability }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const parsed = UsernameInput.safeParse(name);
  if (!parsed.success) return { ok: false, error: "That username is too long" };
  return { ok: true, availability: await usernameAvailability(session.userId, parsed.data) };
}

export async function suggestUsernameAction(): Promise<ActionResult<{ username: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  return { ok: true, username: await suggestUsername(session.userId) };
}

function changeError(result: Exclude<UsernameChangeResult, { ok: true }>): string {
  switch (result.reason) {
    case "invalid":
      return result.problem;
    case "taken":
      return "that username is taken";
    case "same":
      return "that's already your username";
    case "limit":
      return "no username changes left for now";
    case "not_found":
      return "Unauthorized";
  }
}

export async function changeUsernameAction(
  name: string
): Promise<ActionResult<{ username: string; allowance: UsernameAllowance }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const parsed = UsernameInput.safeParse(name);
  if (!parsed.success) return { ok: false, error: "That username is too long" };

  const result = await changeUsername(session.userId, parsed.data);
  if (!result.ok) return { ok: false, error: changeError(result) };

  const allowance = await usernameAllowance(session.userId);
  if (!allowance) return { ok: false, error: "Unauthorized" };
  revalidatePath("/", "layout");
  return { ok: true, username: result.username, allowance };
}
