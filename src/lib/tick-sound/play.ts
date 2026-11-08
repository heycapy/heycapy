import { TICK_SOUND } from "@/constants";
import type { TickSound } from "@/components/looks/constants";
import { TICK_BUZZ_MS, TICK_SOUND_NOTES, type Note } from "./constants";

let context: AudioContext | null = null;

function audio() {
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function playNote(ctx: AudioContext, { from, to = from, at = 0, dur, gain }: Note) {
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const volume = ctx.createGain();
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  // exponential ramps can't reach 0, and a jump to full volume clicks
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.005);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(volume).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playTickSound(sound: TickSound) {
  if (sound === TICK_SOUND.off) return;
  try {
    const ctx = audio();
    for (const note of TICK_SOUND_NOTES[sound]) playNote(ctx, note);
  } catch {
    // no Web Audio (old browser, blocked autoplay): ticking still works, just silently
  }
  navigator.vibrate?.(TICK_BUZZ_MS);
}
