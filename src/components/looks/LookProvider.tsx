"use client";

import { createContext, use, type ReactNode } from "react";
import { LOOK } from "@/constants";
import { LOOK_PARTS, type Look } from "./constants";

const LookContext = createContext<Look>(LOOK.original);

export function LookProvider({ look, children }: { look: Look; children: ReactNode }) {
  return <LookContext value={look}>{children}</LookContext>;
}

export function useLookParts() {
  return LOOK_PARTS[use(LookContext)];
}

// Only the switch in tweaks needs the name; everything that draws reads its parts
export function useLook() {
  return use(LookContext);
}
