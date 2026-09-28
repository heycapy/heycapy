"use client";

import { cn } from "@/lib/utils";
import { SPRITES, SPRITE_SIZE, type SpriteId } from "./sprites";

type SpriteProps = {
  id: SpriteId;
  size?: number;
  bob?: boolean;
  className?: string;
};

export function Sprite({ id, size = SPRITE_SIZE, bob = false, className }: SpriteProps) {
  const { src, frameW, frameH, frameCount, fps } = SPRITES[id];

  const scale = size / frameW;
  const displayW = size;
  const displayH = Math.round(frameH * scale);
  const totalSheetW = frameW * frameCount * scale;
  const animated = frameCount > 1;

  return (
    <div
      className={cn(className)}
      style={{
        width: displayW,
        height: displayH,
        backgroundImage: `url(${src})`,
        backgroundSize: `${totalSheetW}px ${displayH}px`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        flexShrink: 0,
        ...(animated
          ? {
              ["--sheet-w" as string]: `-${totalSheetW}px`,
              animation: `sprite-play ${frameCount / fps}s steps(${frameCount}) infinite`,
            }
          : bob
            ? { animation: "capy-bob 2s ease-in-out infinite" }
            : {}),
      }}
    />
  );
}
