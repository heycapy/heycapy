import { create } from "zustand";

type UIStore = {
  createBucketOpen: boolean;
  openCreateBucket: () => void;
  closeCreateBucket: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  createBucketOpen: false,
  openCreateBucket: () => set({ createBucketOpen: true }),
  closeCreateBucket: () => set({ createBucketOpen: false }),
}));
