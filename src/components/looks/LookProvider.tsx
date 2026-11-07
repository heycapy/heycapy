"use client";

import { createContext, use, type ReactNode } from "react";
import { LOOK_PARTS, type Look } from "./constants";

const LookContext = createContext(LOOK_PARTS.original);

export function LookProvider({ look, children }: { look: Look; children: ReactNode }) {
  return <LookContext value={LOOK_PARTS[look]}>{children}</LookContext>;
}

export function useLookParts() {
  return use(LookContext);
}
