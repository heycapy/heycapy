import { create } from "zustand";

export type ChatState = "closed" | "open" | "minimized" | "fullscreen";

type LayoutStore = {
  chatState: ChatState;
  setChatState: (update: ChatState | ((current: ChatState) => ChatState)) => void;

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
