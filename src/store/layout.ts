import { create } from "zustand";
import type { SettingsTab } from "@/components/buckets/BucketSettingsForm";

export type ChatState = "closed" | "open" | "minimized" | "fullscreen";

export type SidePanel = "tweaks" | "trash" | "archive" | "guide" | "whats-new" | "bucket-settings";

type LayoutStore = {
  chatState: ChatState;
  setChatState: (update: ChatState | ((current: ChatState) => ChatState)) => void;

  sidePanel: SidePanel | null;
  openSidePanel: (panel: SidePanel) => void;
  closeSidePanel: (panel: SidePanel) => void;
  bucketSettings: { bucketId: number; tab: SettingsTab } | null;
  openBucketSettings: (bucketId: number, tab: SettingsTab) => void;
  leaveGuard: (() => boolean) | null;
  setLeaveGuard: (guard: (() => boolean) | null) => void;

  bottomBarShown: boolean;
  setBottomBarShown: (shown: boolean) => void;

  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // the buckets in tab order, as the tab strip shows them; not in the ui store, whose persist
  // middleware would write its defaults over the saved view when this is set before rehydrating
  bucketOrder: number[];
  setBucketOrder: (order: number[]) => void;

  prefixActive: boolean;
  setPrefixActive: (active: boolean) => void;
};

export const useLayoutStore = create<LayoutStore>()((set, get) => {
  const mayLeave = () => get().sidePanel === null || (get().leaveGuard?.() ?? true);

  return {
    chatState: "closed",
    setChatState: (update) => {
      const next = typeof update === "function" ? update(get().chatState) : update;
      if (next === "closed") return set({ chatState: next });
      if (!mayLeave()) return;
      set({ chatState: next, sidePanel: null });
    },

    sidePanel: null,
    openSidePanel: (panel) => {
      if (get().sidePanel === panel || !mayLeave()) return;
      set({ sidePanel: panel, chatState: "closed" });
    },
    closeSidePanel: (panel) => {
      if (get().sidePanel === panel) set({ sidePanel: null });
    },
    bucketSettings: null,
    openBucketSettings: (bucketId, tab) => {
      if (get().sidePanel !== "bucket-settings" && !mayLeave()) return;
      set({ sidePanel: "bucket-settings", bucketSettings: { bucketId, tab }, chatState: "closed" });
    },
    leaveGuard: null,
    setLeaveGuard: (guard) => set({ leaveGuard: guard }),

    bottomBarShown: false,
    setBottomBarShown: (shown) => set({ bottomBarShown: shown }),

    searchOpen: false,
    setSearchOpen: (open) => set({ searchOpen: open }),

    bucketOrder: [],
    setBucketOrder: (order) => set({ bucketOrder: order }),

    prefixActive: false,
    setPrefixActive: (active) => set({ prefixActive: active }),
  };
});
