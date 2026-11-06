import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PlaceSheet = "archive" | "trash" | "join";

type UIStore = {
  createBucketOpen: boolean;
  openCreateBucket: () => void;
  closeCreateBucket: () => void;

  refreshTick: number;
  tickRefresh: () => void;

  // bumped whenever a list of items loads, so the tabs' late marks follow edits made here too
  itemsLoaded: number;
  markItemsLoaded: () => void;

  activeBucketId: number | null;
  setActiveBucketId: (id: number) => void;

  newBucketId: number | null;
  selectNewBucket: (id: number) => void;
  clearNewBucket: () => void;

  todayOpen: boolean;
  openToday: () => void;

  // bumped to open the add form from outside the buckets, e.g. a guide hint
  addItemRequest: number;
  // the full add form rather than the add box
  addItemForm: boolean;
  requestAddItem: (form: boolean) => void;

  // a guide hint asking for the open bucket's members, kept until a bucket view picks it up
  membersRequested: boolean;
  requestMembers: () => void;
  clearMembersRequest: () => void;

  // the ⚙ on the active bucket's tab, kept until that bucket's view picks it up; it names the
  // bucket so a view still fading out after a tab switch leaves it alone
  settingsRequestedId: number | null;
  requestBucketSettings: (id: number) => void;
  clearSettingsRequest: () => void;

  // the item added last stays marked in its list until the next one is added
  lastAddedItemId: number | null;
  markAdded: (id: number) => void;

  highlightedItemId: number | null;
  openItem: (bucketId: number | null, itemId: number) => void;
  clearHighlight: (itemId: number) => void;

  sheet: PlaceSheet | null;
  openSheet: (sheet: PlaceSheet) => void;
  closeSheet: () => void;
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      lastAddedItemId: null,
      markAdded: (id) => set({ lastAddedItemId: id }),

      highlightedItemId: null,
      openItem: (bucketId, itemId) =>
        set(
          bucketId === null
            ? { highlightedItemId: itemId }
            : { activeBucketId: bucketId, todayOpen: false, highlightedItemId: itemId }
        ),
      clearHighlight: (itemId) =>
        set((s) => (s.highlightedItemId === itemId ? { highlightedItemId: null } : {})),

      createBucketOpen: false,
      openCreateBucket: () => set({ createBucketOpen: true }),
      closeCreateBucket: () => set({ createBucketOpen: false }),

      refreshTick: 0,
      tickRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),

      itemsLoaded: 0,
      markItemsLoaded: () => set((s) => ({ itemsLoaded: s.itemsLoaded + 1 })),

      activeBucketId: null,
      setActiveBucketId: (id) => set({ activeBucketId: id, todayOpen: false }),

      newBucketId: null,
      selectNewBucket: (id) => set({ newBucketId: id }),
      clearNewBucket: () => set({ newBucketId: null }),

      todayOpen: true,
      openToday: () => set({ todayOpen: true }),

      addItemRequest: 0,
      addItemForm: false,
      requestAddItem: (form) =>
        set((s) => ({ addItemRequest: s.addItemRequest + 1, addItemForm: form })),

      membersRequested: false,
      requestMembers: () => set({ membersRequested: true, todayOpen: false }),
      clearMembersRequest: () => set({ membersRequested: false }),

      settingsRequestedId: null,
      requestBucketSettings: (id) =>
        set({ settingsRequestedId: id, activeBucketId: id, todayOpen: false }),
      clearSettingsRequest: () => set({ settingsRequestedId: null }),

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
      }),
      skipHydration: true,
    }
  )
);
