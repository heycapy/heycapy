import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PlaceSheet = "archive" | "trash" | "join";

type UIStore = {
  createBucketOpen: boolean;
  openCreateBucket: () => void;
  closeCreateBucket: () => void;

  refreshTick: number;
  tickRefresh: () => void;

  activeBucketId: number | null;
  setActiveBucketId: (id: number) => void;

  newBucketId: number | null;
  selectNewBucket: (id: number) => void;
  clearNewBucket: () => void;

  todayOpen: boolean;
  openToday: () => void;

  todayAddBucketId: number | null;
  setTodayAddBucketId: (id: number) => void;

  // bumped to open the add form from outside the buckets, e.g. a guide hint
  addItemRequest: number;
  requestAddItem: () => void;

  // a guide hint asking for the open bucket's members, kept until a bucket view picks it up
  membersRequested: boolean;
  requestMembers: () => void;
  clearMembersRequest: () => void;

  // the gear next to a bucket in the drawer, kept until that bucket's view picks it up
  settingsRequested: boolean;
  requestBucketSettings: (id: number) => void;
  clearSettingsRequest: () => void;

  sheet: PlaceSheet | null;
  openSheet: (sheet: PlaceSheet) => void;
  closeSheet: () => void;
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      createBucketOpen: false,
      openCreateBucket: () => set({ createBucketOpen: true }),
      closeCreateBucket: () => set({ createBucketOpen: false }),

      refreshTick: 0,
      tickRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),

      activeBucketId: null,
      setActiveBucketId: (id) => set({ activeBucketId: id, todayOpen: false }),

      newBucketId: null,
      selectNewBucket: (id) => set({ newBucketId: id }),
      clearNewBucket: () => set({ newBucketId: null }),

      todayOpen: true,
      openToday: () => set({ todayOpen: true }),

      todayAddBucketId: null,
      setTodayAddBucketId: (id) => set({ todayAddBucketId: id }),

      addItemRequest: 0,
      requestAddItem: () => set((s) => ({ addItemRequest: s.addItemRequest + 1 })),

      membersRequested: false,
      requestMembers: () => set({ membersRequested: true, todayOpen: false }),
      clearMembersRequest: () => set({ membersRequested: false }),

      settingsRequested: false,
      requestBucketSettings: (id) =>
        set({ settingsRequested: true, activeBucketId: id, todayOpen: false }),
      clearSettingsRequest: () => set({ settingsRequested: false }),

      sheet: null,
      openSheet: (sheet) => set({ sheet }),
      closeSheet: () => set({ sheet: null }),
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
