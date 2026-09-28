import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

  activeBucketId: number | null;
  setActiveBucketId: (id: number) => void;

  todayOpen: boolean;
  openToday: () => void;
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

      activeBucketId: null,
      setActiveBucketId: (id) => set({ activeBucketId: id, todayOpen: false }),

      todayOpen: true,
      openToday: () => set({ todayOpen: true }),
    }),
    {
      name: "heycapy-ui",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ activeBucketId: s.activeBucketId, todayOpen: s.todayOpen }),
      skipHydration: true,
    }
  )
);
