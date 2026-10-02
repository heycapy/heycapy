export type SpriteId =
  | "capy-mascot"
  | "capy-mascot-sleep"
  | "capy-idle-blink"
  | "capy-idle"
  | "capy-thinking"
  | "capy-error"
  | "capy-walk"
  | "pingu"
  | "pingu-walk";

type SpriteConfig = {
  src: string;
  frameW: number;
  frameH: number;
  frameCount: number;
  fps: number;
};

export const SPRITES: Record<SpriteId, SpriteConfig> = {
  "capy-mascot": { src: "/sprites/capy-mascot.png", frameW: 48, frameH: 48, frameCount: 1, fps: 1 },
  "capy-mascot-sleep": {
    src: "/sprites/capy-mascot-sleep.png",
    frameW: 24,
    frameH: 48,
    frameCount: 1,
    fps: 1,
  },
  "capy-idle-blink": {
    src: "/sprites/capy-idle-blink.png",
    frameW: 64,
    frameH: 64,
    frameCount: 8,
    fps: 8,
  },
  "capy-idle": { src: "/sprites/capy-idle.png", frameW: 192, frameH: 192, frameCount: 1, fps: 1 },
  "capy-thinking": {
    src: "/sprites/capy-thinking.png",
    frameW: 34,
    frameH: 34,
    frameCount: 8,
    fps: 8,
  },
  "capy-error": { src: "/sprites/capy-error.png", frameW: 64, frameH: 64, frameCount: 8, fps: 8 },
  "capy-walk": { src: "/sprites/capy-walk.png", frameW: 32, frameH: 32, frameCount: 8, fps: 8 },
  pingu: { src: "/sprites/pingu.png", frameW: 64, frameH: 64, frameCount: 1, fps: 1 },
  "pingu-walk": { src: "/sprites/pingu-walk.png", frameW: 64, frameH: 64, frameCount: 8, fps: 8 },
};

export const SPRITE_SIZE = 128;
