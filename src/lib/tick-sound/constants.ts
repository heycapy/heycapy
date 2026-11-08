import type { TICK_SOUND } from "@/constants";

export type Note = { from: number; to?: number; at?: number; dur: number; gain: number };

export const TICK_SOUND_NOTES: Record<typeof TICK_SOUND.drop | typeof TICK_SOUND.chime, Note[]> = {
  drop: [{ from: 380, to: 1300, dur: 0.07, gain: 0.18 }],
  chime: [
    { from: 880, dur: 0.25, gain: 0.1 },
    { from: 1318.5, at: 0.07, dur: 0.35, gain: 0.08 },
  ],
};

export const TICK_BUZZ_MS = 10;
