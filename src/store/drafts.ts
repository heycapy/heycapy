import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RecurringConfig } from "@/types/rules";

export type ItemDraft = {
  title: string;
  assigneeIds: number[] | null;
  deadline: string | null;
  status: string | null;
  recurring: RecurringConfig | null;
  reminders: number[] | null;
  properties: Record<string, unknown>;
};

export const EMPTY_DRAFT: ItemDraft = {
  title: "",
  assigneeIds: null,
  deadline: null,
  status: null,
  recurring: null,
  reminders: null,
  properties: {},
};

type DraftStore = {
  drafts: Record<number, ItemDraft>;
  updateDraft: (bucketId: number, patch: Partial<ItemDraft>) => void;
  clearDraft: (bucketId: number) => void;
  clearAll: () => void;
};

export const useDraftStore = create<DraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      updateDraft: (bucketId, patch) =>
        set((s) => ({
          drafts: { ...s.drafts, [bucketId]: { ...(s.drafts[bucketId] ?? EMPTY_DRAFT), ...patch } },
        })),
      clearDraft: (bucketId) =>
        set((s) => ({
          drafts: Object.fromEntries(
            Object.entries(s.drafts).filter(([id]) => Number(id) !== bucketId)
          ),
        })),
      clearAll: () => set({ drafts: {} }),
    }),
    {
      name: "heycapy-drafts",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
    }
  )
);

export function useDraft(bucketId: number): ItemDraft {
  return useDraftStore((s) => s.drafts[bucketId] ?? EMPTY_DRAFT);
}

export function isEmptyDraft(draft: ItemDraft): boolean {
  return (
    !draft.title.trim() &&
    draft.assigneeIds === null &&
    draft.deadline === null &&
    draft.status === null &&
    draft.recurring === null &&
    draft.reminders === null &&
    Object.keys(draft.properties).length === 0
  );
}
