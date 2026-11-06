import { create } from "zustand";

export type ChatState = "closed" | "open" | "minimized" | "fullscreen";

export type SidePanel = "tweaks" | "trash" | "archive" | "guide" | "whats-new";

type LayoutStore = {
  chatState: ChatState;
  setChatState: (update: ChatState | ((current: ChatState) => ChatState)) => void;

  sidePanel: SidePanel | null;
  openSidePanel: (panel: SidePanel) => void;
  closeSidePanel: (panel: SidePanel) => void;
  leaveGuard: (() => boolean) | null;
  setLeaveGuard: (guard: (() => boolean) | null) => void;

  bottomBarShown: boolean;
  setBottomBarShown: (shown: boolean) => void;

  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
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
    leaveGuard: null,
    setLeaveGuard: (guard) => set({ leaveGuard: guard }),

    bottomBarShown: false,
    setBottomBarShown: (shown) => set({ bottomBarShown: shown }),

    searchOpen: false,
    setSearchOpen: (open) => set({ searchOpen: open }),
  };
});
