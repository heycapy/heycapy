"use client";

import { createContext, use, useEffect, useOptimistic, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { DEFAULT_APPEARANCE } from "@/lib/account/constants";
import {
  LOOK_PARTS,
  type ControlSize,
  type Look,
  type TextSize,
  type TickSound,
} from "./constants";

type Appearance = {
  look: Look;
  controlSize: ControlSize;
  tickSound: TickSound;
  reduceMotion: boolean;
  textSize: TextSize;
};

const LookContext = createContext<Appearance>(DEFAULT_APPEARANCE);
const PreviewContext = createContext<(change: Partial<Appearance>) => void>(() => {});

export function LookProvider({
  children,
  ...appearance
}: Partial<Appearance> & { look: Look; children: ReactNode }) {
  const [value, preview] = useOptimistic(
    { ...use(LookContext), ...appearance },
    (current, change: Partial<Appearance>) => ({ ...current, ...change })
  );

  useEffect(() => {
    if (value.reduceMotion) document.documentElement.dataset.motion = "reduce";
    else delete document.documentElement.dataset.motion;
  }, [value.reduceMotion]);

  return (
    <LookContext value={value}>
      <PreviewContext value={preview}>
        <MotionConfig reducedMotion={value.reduceMotion ? "always" : "user"}>
          {children}
        </MotionConfig>
      </PreviewContext>
    </LookContext>
  );
}

export function usePreviewAppearance() {
  return use(PreviewContext);
}

export function useLookParts() {
  return LOOK_PARTS[use(LookContext).look];
}

// Only the switches in tweaks need these; everything that draws uses its parts
export function useLook() {
  return use(LookContext).look;
}

export function useControlSize() {
  return use(LookContext).controlSize;
}

export function useTickSound() {
  return use(LookContext).tickSound;
}

export function useReduceMotion() {
  return use(LookContext).reduceMotion;
}

export function useTextSize() {
  return use(LookContext).textSize;
}
