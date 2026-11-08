import { TICK_SOUND_OFF } from "@/constants";
import type { TickSound } from "@/components/looks/constants";
import { TICK_BUZZ_MS } from "./constants";
import { playSound } from "./play";

export function playTickSound(sound: TickSound) {
  if (sound === TICK_SOUND_OFF) return;
  navigator.vibrate?.(TICK_BUZZ_MS);
  // no Web Audio or a blocked context: the tick still works, silently
  playSound(sound).catch(() => {});
}
