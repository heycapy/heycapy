import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type UIStore = {
  createBucketOpen: boolean;
  openCreateBucket: () => void;
  closeCreateBucket: () => void;

  aiRefreshTick: number;
  tickAiRefresh: () => void;

  activeBucketId: number | null;
  setActiveBucketId: (id: number) => void;

  todayOpen: boolean;
  openToday: () => void;

  // Adding from today goes into this bucket until another is picked
  todayAddBucketId: number | null;
  setTodayAddBucketId: (id: number) => void;
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      createBucketOpen: false,
      openCreateBucket: () => set({ createBucketOpen: true }),
      closeCreateBucket: () => set({ createBucketOpen: false }),

      aiRefreshTick: 0,
      tickAiRefresh: () => set((s) => ({ aiRefreshTick: s.aiRefreshTick + 1 })),

      activeBucketId: null,
      setActiveBucketId: (id) => set({ activeBucketId: id, todayOpen: false }),

      todayOpen: true,
      openToday: () => set({ todayOpen: true }),

      todayAddBucketId: null,
      setTodayAddBucketId: (id) => set({ todayAddBucketId: id }),
    }),
    {
      name: "heycapy-ui",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        activeBucketId: s.activeBucketId,
        todayOpen: s.todayOpen,
        todayAddBucketId: s.todayAddBucketId,
      }),
      skipHydration: true,
    }
  )
);
