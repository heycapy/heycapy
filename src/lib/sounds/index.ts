import { BUILT_IN_SOUNDS } from "./built-in";
import type { Sound } from "./types";

export const SOUNDS: Record<SoundId, Sound> = BUILT_IN_SOUNDS;

export type SoundId = keyof typeof BUILT_IN_SOUNDS;

export const SOUND_IDS = Object.keys(BUILT_IN_SOUNDS) as [SoundId, ...SoundId[]];
