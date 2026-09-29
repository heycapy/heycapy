import { create } from "zustand";

export type ChatState = "closed" | "open" | "minimized" | "fullscreen";

// Not persisted: a set() on a persisted store before it hydrates overwrites the saved state
type LayoutStore = {
  chatState: ChatState;
  setChatState: (update: ChatState | ((current: ChatState) => ChatState)) => void;

  // the buckets bottom bar has its own capy button, so the floating one steps aside
  bottomBarShown: boolean;
  setBottomBarShown: (shown: boolean) => void;
};

export const useLayoutStore = create<LayoutStore>()((set) => ({
  chatState: "closed",
  setChatState: (update) =>
    set((s) => ({ chatState: typeof update === "function" ? update(s.chatState) : update })),

  bottomBarShown: false,
  setBottomBarShown: (shown) => set({ bottomBarShown: shown }),
}));
