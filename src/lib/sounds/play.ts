import { SOUNDS, type SoundId } from ".";
import {
  SOUND_ATTACK_SECONDS,
  SOUND_PLUCK_DECAY,
  SOUND_ROOM_MIX,
  SOUND_ROOM_SECONDS,
} from "./constants";
import type { Voice } from "./types";

type Output = { ctx: AudioContext; out: AudioNode };

let output: Output | null = null;
const plucks = new Map<string, AudioBuffer>();
const files = new Map<string, Promise<AudioBuffer>>();

// One context for the page, with a short generated room echo so tones don't sound like beeps
function audio(): Output {
  if (!output) {
    const ctx = new AudioContext();
    const out = ctx.createGain();
    const room = ctx.createConvolver();
    const wet = ctx.createGain();
    const length = Math.floor(ctx.sampleRate * SOUND_ROOM_SECONDS);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4;
    }
    room.buffer = impulse;
    wet.gain.value = SOUND_ROOM_MIX;
    out.connect(ctx.destination);
    out.connect(room).connect(wet).connect(ctx.destination);
    output = { ctx, out };
  }
  if (output.ctx.state === "suspended") void output.ctx.resume();
  return output;
}

function playTone({ ctx, out }: Output, voice: Extract<Voice, { kind: "tone" }>) {
  const start = ctx.currentTime + (voice.at ?? 0);
  for (const [ratio, level, seconds] of voice.partials) {
    const osc = ctx.createOscillator();
    const volume = ctx.createGain();
    osc.frequency.value = voice.freq * ratio;
    // exponential ramps can't reach 0, and a jump to full volume clicks
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(voice.gain * level, start + SOUND_ATTACK_SECONDS);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(volume).connect(out);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }
}

// Karplus-Strong: a burst of noise fed through a short averaging delay rings like a string
function pluckBuffer(ctx: AudioContext, voice: Extract<Voice, { kind: "pluck" }>) {
  const key = `${voice.freq}:${voice.seconds}:${voice.bright}`;
  const cached = plucks.get(key);
  if (cached) return cached;
  const length = Math.ceil(ctx.sampleRate * voice.seconds);
  const period = Math.round(ctx.sampleRate / voice.freq);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < period; i++) data[i] = Math.random() * 2 - 1;
  for (let i = period; i < length; i++) {
    const a = data[i - period] ?? 0;
    const b = data[i - period + 1] ?? 0;
    data[i] = (a * voice.bright + b * (1 - voice.bright)) * SOUND_PLUCK_DECAY;
  }
  plucks.set(key, buffer);
  return buffer;
}

function playPluck({ ctx, out }: Output, voice: Extract<Voice, { kind: "pluck" }>) {
  const start = ctx.currentTime + (voice.at ?? 0);
  const source = ctx.createBufferSource();
  const volume = ctx.createGain();
  source.buffer = pluckBuffer(ctx, voice);
  volume.gain.setValueAtTime(voice.gain, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + voice.seconds);
  source.connect(volume).connect(out);
  source.start(start);
}

async function playFile({ ctx, out }: Output, url: string) {
  let decoded = files.get(url);
  if (!decoded) {
    decoded = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((bytes) => ctx.decodeAudioData(bytes));
    files.set(url, decoded);
  }
  const source = ctx.createBufferSource();
  source.buffer = await decoded;
  source.connect(out);
  source.start();
}

export async function playSound(id: SoundId) {
  const sound = SOUNDS[id];
  const target = audio();
  if (sound.source.kind === "file") return await playFile(target, sound.source.url);
  for (const voice of sound.source.voices) {
    if (voice.kind === "tone") playTone(target, voice);
    else playPluck(target, voice);
  }
}
