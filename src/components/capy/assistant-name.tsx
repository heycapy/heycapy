"use client";

import { createContext, useContext, type ReactNode } from "react";

const AssistantNameContext = createContext("capy");

export function AssistantNameProvider({ name, children }: { name: string; children: ReactNode }) {
  return (
    <AssistantNameContext.Provider value={name.trim().toLowerCase() || "capy"}>
      {children}
    </AssistantNameContext.Provider>
  );
}

export function useAssistantName(): string {
  return useContext(AssistantNameContext);
}
