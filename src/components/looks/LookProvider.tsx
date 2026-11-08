"use client";

import { createContext, use, type ReactNode } from "react";
import { CONTROL_SIZE, LOOK, TICK_SOUND } from "@/constants";
import { LOOK_PARTS, type ControlSize, type Look, type TickSound } from "./constants";

const LookContext = createContext<{ look: Look; controlSize: ControlSize; tickSound: TickSound }>({
  look: LOOK.original,
  controlSize: CONTROL_SIZE.medium,
  tickSound: TICK_SOUND.drop,
});

export function LookProvider({
  look,
  controlSize = CONTROL_SIZE.medium,
  tickSound = TICK_SOUND.drop,
  children,
}: {
  look: Look;
  controlSize?: ControlSize;
  tickSound?: TickSound;
  children: ReactNode;
}) {
  return <LookContext value={{ look, controlSize, tickSound }}>{children}</LookContext>;
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
