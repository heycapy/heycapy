import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserStatus } from "@/types/status";

type UIStore = {
  createBucketOpen: boolean;
  openCreateBucket: () => void;
  closeCreateBucket: () => void;

  chatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;

  aiRefreshTick: number;
  tickAiRefresh: () => void;

  statuses: UserStatus[];
  setStatuses: (s: UserStatus[]) => void;

  activeBucketId: number | null;
  setActiveBucketId: (id: number) => void;
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      createBucketOpen: false,
      openCreateBucket: () => set({ createBucketOpen: true }),
      closeCreateBucket: () => set({ createBucketOpen: false }),

      chatOpen: false,
      openChat: () => set({ chatOpen: true }),
      closeChat: () => set({ chatOpen: false }),
      toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

      aiRefreshTick: 0,
      tickAiRefresh: () => set((s) => ({ aiRefreshTick: s.aiRefreshTick + 1 })),

      statuses: [],
      setStatuses: (s) => set({ statuses: s }),

      activeBucketId: null,
      setActiveBucketId: (id) => set({ activeBucketId: id }),
    }),
    {
      name: "heycapy-ui",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ activeBucketId: s.activeBucketId }),
      skipHydration: true,
    }
  )
);
