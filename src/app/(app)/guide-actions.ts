"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "./action-helpers";
import { z } from "zod";
import { OPENED_GUIDE_TASKS } from "@/lib/guide/constants";
import {
  markGuideSeen,
  markGuideTaskDone,
  setGuideHidden,
  syncGuide,
  type GuideState,
} from "@/lib/guide/guide";

export async function getGuideAction(): Promise<GuideState> {
  const session = await requireSession();
  return syncGuide(session.userId);
}

// The theme lives in the browser (next-themes), so the server only learns it was picked from here
export async function pickedThemeAction(): Promise<void> {
  const session = await requireSession();
  await markGuideTaskDone(session.userId, "theme");
  revalidatePath("/");
}

export async function openedGuideTaskAction(
  task: (typeof OPENED_GUIDE_TASKS)[number]
): Promise<void> {
  const session = await requireSession();
  await markGuideTaskDone(session.userId, z.enum(OPENED_GUIDE_TASKS).parse(task));
  revalidatePath("/");
}

export async function hideGuideAction(hidden: boolean): Promise<void> {
  const session = await requireSession();
  await setGuideHidden(session.userId, z.boolean().parse(hidden));
  revalidatePath("/");
}

export async function markGuideSeenAction(): Promise<void> {
  const session = await requireSession();
  await markGuideSeen(session.userId);
}
