import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { GREETING } from "@/components/capy/chatTypes";
import type { ChatMessage } from "@/components/capy/chatTypes";

type ChatStore = {
  messages: ChatMessage[];
  sessionId: number | null;
  setMessages: (msgs: ChatMessage[]) => void;
  setSessionId: (id: number | null) => void;
  appendChunkToLast: (chunk: string) => void;
  markLastStopped: () => void;
  markLastError: (message?: string) => void;
  clearChat: () => void;
  loadSession: (id: number, msgs: ChatMessage[]) => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [GREETING],
      sessionId: null,

      setMessages: (msgs) => set({ messages: msgs }),
      setSessionId: (id) => set({ sessionId: id }),

      appendChunkToLast: (chunk) =>
        set((s) => {
          const last = s.messages.at(-1);
          if (!last) return s;
          return {
            messages: [...s.messages.slice(0, -1), { ...last, content: last.content + chunk }],
          };
        }),

      markLastStopped: () =>
        set((s) => {
          const last = s.messages.at(-1);
          if (!last) return s;
          return { messages: [...s.messages.slice(0, -1), { ...last, stopped: true }] };
        }),

      markLastError: (message) =>
        set((s) => {
          const last = s.messages.at(-1);
          if (!last) return s;
          return {
            messages: [
              ...s.messages.slice(0, -1),
              { ...last, content: message ?? "Something went wrong. Try again." },
            ],
          };
        }),

      clearChat: () => set({ messages: [GREETING], sessionId: null }),

      loadSession: (id, msgs) => set({ messages: msgs, sessionId: id }),
    }),
    {
      name: "heycapy-chat",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ messages: s.messages, sessionId: s.sessionId }),
      skipHydration: true,
    }
  )
);
