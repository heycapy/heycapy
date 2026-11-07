"use client";

import { createContext, use, type ReactNode } from "react";
import { CONTROL_SIZE, LOOK } from "@/constants";
import { LOOK_PARTS, type ControlSize, type Look } from "./constants";

const LookContext = createContext<{ look: Look; controlSize: ControlSize }>({
  look: LOOK.original,
  controlSize: CONTROL_SIZE.medium,
});

export function LookProvider({
  look,
  controlSize = CONTROL_SIZE.medium,
  children,
}: {
  look: Look;
  controlSize?: ControlSize;
  children: ReactNode;
}) {
  return <LookContext value={{ look, controlSize }}>{children}</LookContext>;
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
