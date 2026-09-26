"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  getChatSessionsAction,
  getChatMessagesAction,
  deleteChatSessionAction,
} from "@/app/(app)/actions";
import type { ChatMessage } from "./chatTypes";
import { GREETING } from "./chatTypes";

type Session = { id: number; title: string; updatedAt: Date };

function relativeDate(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

type Props = {
  open: boolean;
  onClose: () => void;
  onLoadSession: (id: number, msgs: ChatMessage[]) => void;
  onNewChat: () => void;
};

export function ChatHistorySheet({ open, onClose, onLoadSession, onNewChat }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setConfirmingId(null);
      setLoading(true);
      void getChatSessionsAction().then((result) => {
        setSessions(result);
        setLoading(false);
      });
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  function handleLoad(sessionId: number) {
    startTransition(async () => {
      const msgs = await getChatMessagesAction(sessionId);
      if (!msgs) return;
      const chatMsgs: ChatMessage[] = [
        GREETING,
        ...msgs.map((m) => ({ id: crypto.randomUUID(), role: m.role, content: m.content })),
      ];
      onLoadSession(sessionId, chatMsgs);
      onClose();
    });
  }

  function handleDelete(sessionId: number) {
    startTransition(async () => {
      await deleteChatSessionAction(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setConfirmingId(null);
    });
  }

  function handleNewChat() {
    onNewChat();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[55] bg-black"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="bg-background border-border fixed top-0 right-0 z-[60] flex h-full w-full flex-col border-l-2 sm:w-80"
            style={{ boxShadow: "-4px 0 0 var(--border)" }}
          >
            <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
              <span className="font-pixel text-xs">chat history</span>
              <BracketButton variant="inverted" onClick={onClose}>
                x
              </BracketButton>
            </div>

            <div className="border-border border-b px-4 py-2">
              <BracketButton onClick={handleNewChat} disabled={pending}>
                new chat
              </BracketButton>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto">
              {loading ? (
                <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
                  loading...
                </p>
              ) : sessions.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
                  no history yet
                </p>
              ) : (
                <div className="divide-border divide-y">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs">{s.title}</p>
                        <p className="text-muted-foreground/60 mt-0.5 font-mono text-[10px]">
                          {relativeDate(s.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {confirmingId === s.id ? (
                          <>
                            <BracketButton
                              variant="destructive"
                              onClick={() => handleDelete(s.id)}
                              disabled={pending}
                            >
                              confirm
                            </BracketButton>
                            <BracketButton onClick={() => setConfirmingId(null)} disabled={pending}>
                              cancel
                            </BracketButton>
                          </>
                        ) : (
                          <>
                            <BracketButton onClick={() => handleLoad(s.id)} disabled={pending}>
                              load
                            </BracketButton>
                            <BracketButton
                              variant="destructive"
                              onClick={() => setConfirmingId(s.id)}
                              disabled={pending}
                            >
                              delete
                            </BracketButton>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
