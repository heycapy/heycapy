import { create } from "zustand";

type UIStore = {
  createBucketOpen: boolean;
  openCreateBucket: () => void;
  closeCreateBucket: () => void;

  chatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  createBucketOpen: false,
  openCreateBucket: () => set({ createBucketOpen: true }),
  closeCreateBucket: () => set({ createBucketOpen: false }),

  chatOpen: false,
  openChat: () => set({ chatOpen: true }),
  closeChat: () => set({ chatOpen: false }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
}));
