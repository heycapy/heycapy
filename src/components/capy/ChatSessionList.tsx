import { useEffect, useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  getChatSessionsAction,
  getChatMessagesAction,
  deleteChatSessionAction,
} from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
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
  enabled: boolean;
  refreshKey?: string;
  activeId: number | null;
  onLoadSession: (id: number, msgs: ChatMessage[]) => void;
  onNewChat: () => void;
  onDone?: () => void;
};

export function ChatSessionList({
  enabled,
  refreshKey,
  activeId,
  onLoadSession,
  onNewChat,
  onDone,
}: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const id = setTimeout(() => {
      setConfirmingId(null);
      void getChatSessionsAction().then((result) => {
        if (cancelled) return;
        setSessions(result);
        setLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [enabled, refreshKey]);

  function handleLoad(sessionId: number) {
    startTransition(async () => {
      const msgs = await getChatMessagesAction(sessionId);
      if (!msgs) return;
      const chatMsgs: ChatMessage[] = [
        GREETING,
        ...msgs.map((m) => ({ id: crypto.randomUUID(), role: m.role, content: m.content })),
      ];
      onLoadSession(sessionId, chatMsgs);
      onDone?.();
    });
  }

  function handleDelete(sessionId: number) {
    startTransition(async () => {
      await deleteChatSessionAction(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setConfirmingId(null);
      if (sessionId === activeId) onNewChat();
    });
  }

  function handleNewChat() {
    onNewChat();
    onDone?.();
  }

  return (
    <>
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
              <div
                key={s.id}
                aria-current={s.id === activeId ? "true" : undefined}
                className={cn("flex items-center gap-3 px-4 py-3", s.id === activeId && "bg-muted")}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">{s.title}</p>
                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">
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
    </>
  );
}
