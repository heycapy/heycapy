import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, LogOut, SlidersHorizontal, Trash2 } from "lucide-react";
import { BracketButton } from "@/components/ui/BracketButton";
import { logoutAction, logoutEverywhereAction } from "@/app/(app)/actions";
import { useScrollLock } from "@/hooks/useScrollLock";

type HeaderProps = {
  email: string;
  onSettingsOpen: () => void;
  onArchiveOpen: () => void;
  onTrashOpen: () => void;
};

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good night";
}

function getDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

type LogoutScope = "here" | "everywhere";

const LOGOUT_COPY: Record<LogoutScope, { title: string; body: string; action: string }> = {
  here: { title: "log out?", body: "you'll need to log in again.", action: "log out" },
  everywhere: {
    title: "log out everywhere?",
    body: "ends your sessions on every device, including this one.",
    action: "log out everywhere",
  },
};

function LogoutConfirm({
  scope,
  onConfirm,
  onCancel,
}: {
  scope: LogoutScope;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = LOGOUT_COPY[scope];
  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} />
      <div
        className="bg-background border-border fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 border-2 p-5"
        style={{ boxShadow: "3px 3px 0 var(--border)", minWidth: 220 }}
      >
        <p className="font-pixel mb-1 text-sm">{copy.title}</p>
        <p className="text-muted-foreground mb-4 font-mono text-xs">{copy.body}</p>
        <div className="flex gap-2">
          <BracketButton onClick={onConfirm} variant="destructive" className="px-2 py-1">
            {copy.action}
          </BracketButton>
          <BracketButton onClick={onCancel} className="px-2 py-1">
            cancel
          </BracketButton>
        </div>
      </div>
    </>,
    document.body
  );
}

function GlobalMenu({
  email,
  onSettings,
  onArchive,
  onTrash,
}: {
  email: string;
  onSettings: () => void;
  onArchive: () => void;
  onTrash: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState<LogoutScope | null>(null);
  useScrollLock(confirmLogout !== null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function toggle() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.right });
    setOpen((v) => !v);
  }

  function pick(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <>
      <div ref={containerRef}>
        <BracketButton onClick={toggle} className="px-1 py-1.5">
          ···
        </BracketButton>
      </div>

      {confirmLogout && (
        <LogoutConfirm
          scope={confirmLogout}
          onConfirm={() =>
            void (confirmLogout === "everywhere" ? logoutEverywhereAction() : logoutAction())
          }
          onCancel={() => setConfirmLogout(null)}
        />
      )}

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div
              className="bg-background border-border fixed z-40 w-max max-w-[calc(100vw-2rem)] min-w-44 border-2 py-1 whitespace-nowrap"
              style={{
                top: pos.top,
                left: pos.left,
                transform: "translateX(-100%)",
                boxShadow: "2px 2px 0 var(--border)",
              }}
            >
              <div className="text-muted-foreground border-border mb-1 max-w-64 truncate border-b px-3 pt-0.5 pb-1.5 font-mono text-xs">
                {email}
              </div>
              <button
                onClick={() => pick(onSettings)}
                className="text-foreground hover:bg-muted flex w-full items-center gap-2.5 px-3 py-2 font-mono text-xs transition-colors"
              >
                <SlidersHorizontal size={11} />
                tweaks
              </button>
              <button
                onClick={() => pick(onArchive)}
                className="text-foreground hover:bg-muted flex w-full items-center gap-2.5 px-3 py-2 font-mono text-xs transition-colors"
              >
                <Archive size={11} />
                archived
              </button>
              <button
                onClick={() => pick(onTrash)}
                className="text-foreground hover:bg-muted flex w-full items-center gap-2.5 px-3 py-2 font-mono text-xs transition-colors"
              >
                <Trash2 size={11} />
                trash
              </button>
              <div className="border-border my-1 border-t" />
              <button
                onClick={() => pick(() => setConfirmLogout("here"))}
                className="text-destructive hover:bg-muted flex w-full items-center gap-2.5 px-3 py-2 font-mono text-xs transition-colors"
              >
                <LogOut size={11} />
                logout
              </button>
              <button
                onClick={() => pick(() => setConfirmLogout("everywhere"))}
                className="text-destructive hover:bg-muted flex w-full items-center gap-2.5 px-3 py-2 font-mono text-xs transition-colors"
              >
                <LogOut size={11} />
                logout everywhere
              </button>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export function Header({ email, onSettingsOpen, onArchiveOpen, onTrashOpen }: HeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const date = useMemo(() => getDate(), []);

  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-2">
      <div>
        <h1 className="font-pixel text-base leading-snug">{greeting}</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">{date}</p>
      </div>

      <GlobalMenu
        email={email}
        onSettings={onSettingsOpen}
        onArchive={onArchiveOpen}
        onTrash={onTrashOpen}
      />
    </header>
  );
}
