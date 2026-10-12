import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type TimezoneStore = {
  // The browser zone the person chose not to switch to, so they're asked again only after moving on
  keptIn: string | null;
  keep: (browserTimezone: string) => void;
};

export const useTimezoneStore = create<TimezoneStore>()(
  persist(
    (set) => ({
      keptIn: null,
      keep: (browserTimezone) => set({ keptIn: browserTimezone }),
    }),
    {
      name: "heycapy-timezone",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
