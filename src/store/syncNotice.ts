import { create } from "zustand";

type SyncNotice = { kind: "offline" | "unsent"; count: number; itemIds: ReadonlySet<string> };

// What the person should be told about syncing, null while everything is going out normally;
// `itemIds` are the items with a change that has not reached the server. Kept apart from the ui
// store on purpose: that one is persisted, and a write to it before it has loaded its saved state
// would replace the remembered view
export const useSyncNoticeStore = create<{
  notice: SyncNotice | null;
  setNotice: (notice: SyncNotice | null) => void;
}>((set) => ({
  notice: null,
  setNotice: (notice) => set({ notice }),
}));
