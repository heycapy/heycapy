// A sound is data, never code, so a sound pack can come from a file or an import later
export type Overtone = [ratio: number, gain: number, seconds: number];

export type Voice =
  | { kind: "tone"; freq: number; partials: Overtone[]; gain: number; at?: number }
  | { kind: "pluck"; freq: number; seconds: number; gain: number; bright: number; at?: number };

export type SoundSource = { kind: "synth"; voices: Voice[] } | { kind: "file"; url: string };

export type Sound = { label: string; source: SoundSource };
