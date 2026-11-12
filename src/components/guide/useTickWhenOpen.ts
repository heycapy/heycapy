import { useEffect } from "react";
import { openedGuideTaskAction } from "@/app/(app)/actions";
import type { OPENED_GUIDE_TASKS } from "@/lib/guide/constants";
import type { GuideState } from "@/lib/guide/guide";

export function useTickWhenOpen(
  guide: GuideState,
  task: (typeof OPENED_GUIDE_TASKS)[number],
  open: boolean
) {
  const pending = open && guide.tasks.some((t) => t.key === task && !t.done);
  useEffect(() => {
    if (pending) void openedGuideTaskAction(task);
  }, [pending, task]);
}
