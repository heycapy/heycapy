import { describe, expect, it, vi } from "vitest";
import { doableTasks } from "@/components/guide/useGuide";
import { GUIDE_TASKS } from "@/lib/guide/constants";
import type { GuideState } from "@/lib/guide/guide";

vi.mock("@/app/(app)/actions", () => ({ getGuideAction: vi.fn(), hideGuideAction: vi.fn() }));

const guide: GuideState = {
  tasks: GUIDE_TASKS.map((task) => ({ ...task, done: false, earned: 0 })),
  paysCredits: true,
  hidden: false,
  seen: true,
};

describe("tasks this page can do", () => {
  it("leaves push out on plain http, browsers only allow it on https", () => {
    const keys = doableTasks(guide, false, true).tasks.map((task) => task.key);
    expect(keys).not.toContain("push");
    expect(keys).toHaveLength(GUIDE_TASKS.length - 1);
  });

  it("leaves the shortcuts task out when there's no keyboard", () => {
    const keys = doableTasks(guide, true, false).tasks.map((task) => task.key);
    expect(keys).not.toContain("keyboard_shortcuts");
    expect(keys).toHaveLength(GUIDE_TASKS.length - 1);
  });

  it("keeps every task on https with a keyboard", () => {
    expect(doableTasks(guide, true, true).tasks).toHaveLength(GUIDE_TASKS.length);
  });
});
