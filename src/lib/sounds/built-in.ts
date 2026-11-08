import type { Sound, Voice } from "./types";

const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 784;
const A5 = 880;

const SPARKLE_GAP = 0.055;
const HARP_GAP = 0.04;

const bell = (freq: number, at = 0): Voice => ({
  kind: "tone",
  freq,
  at,
  gain: 0.08,
  partials: [
    [1, 1, 0.3],
    [2, 0.12, 0.12],
  ],
});

export const BUILT_IN_SOUNDS = {
  chime: {
    label: "chime",
    source: {
      kind: "synth",
      voices: [
        { kind: "tone", freq: A5, gain: 0.1, partials: [[1, 1, 0.25]] },
        { kind: "tone", freq: E6, at: 0.07, gain: 0.08, partials: [[1, 1, 0.35]] },
      ],
    },
  },
  sparkle: {
    label: "sparkle",
    source: {
      kind: "synth",
      voices: [C6, E6, G6].map((freq, i) => bell(freq, i * SPARKLE_GAP)),
    },
  },
  success: {
    label: "success",
    source: {
      kind: "synth",
      voices: [
        {
          kind: "tone",
          freq: G5,
          gain: 0.14,
          partials: [
            [1, 1, 0.4],
            [5.4, 0.15, 0.1],
          ],
        },
        {
          kind: "tone",
          freq: C6,
          at: 0.09,
          gain: 0.14,
          partials: [
            [1, 1, 0.55],
            [5.4, 0.15, 0.12],
          ],
        },
      ],
    },
  },
  harp: {
    label: "harp",
    source: {
      kind: "synth",
      voices: [C5, E5, G5, C6].map((freq, i) => ({
        kind: "pluck",
        freq,
        seconds: 0.6,
        gain: 0.18,
        bright: 0.6,
        at: i * HARP_GAP,
      })),
    },
  },
} satisfies Record<string, Sound>;
