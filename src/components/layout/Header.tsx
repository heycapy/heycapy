import { Icon } from "@/components/ui/Icon";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BetaTag } from "@/components/ui/BetaTag";
import { TextButton } from "@/components/ui/TextButton";
import { logoutAction, logoutEverywhereAction } from "@/app/(app)/actions";
import { clearSignedInState } from "@/store/signedOut";
import { Modal, ModalTitle } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { MenuItem } from "@/components/ui/MenuItem";

type HeaderProps = {
  email: string;
  userId: number;
  avatar: string | null;
  onSettingsOpen: () => void;
  onArchiveOpen: () => void;
  onTrashOpen: () => void;
  onJoinOpen: () => void;
  onFeedbackOpen: (() => void) | null;
  onWhatsNewOpen: () => void;
  unseenRelease: boolean;
  onGuideOpen: () => void;
  guideProgress: string;
  guideUnfinished: boolean;
};

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
  return (
    <Modal
      open
      onClose={onCancel}
      className="top-1/2 w-auto max-w-[calc(100%-2rem)] min-w-[220px] -translate-y-1/2 shadow-[3px_3px_0_var(--border)] sm:top-1/2"
    >
      <div className="bg-background border-border border-2 p-5">
        <ModalTitle className="mb-1 text-sm">{copy.title}</ModalTitle>
        <p className="text-muted-foreground font-ui mb-4 text-xs">{copy.body}</p>
        <div className="flex gap-2">
          <TextButton onClick={onConfirm} variant="destructive" className="px-2 py-1">
            {copy.action}
          </TextButton>
          <TextButton onClick={onCancel} className="px-2 py-1">
            cancel
          </TextButton>
        </div>
      </div>
    </Modal>
  );
}

function NewDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("bg-primary size-1.5 shrink-0", className)} />;
}

function GlobalMenu({
  email,
  userId,
  avatar,
  showDot,
  onSettings,
  onArchive,
  onTrash,
  onJoin,
  onFeedback,
  onWhatsNew,
  unseenRelease,
  onGuide,
  guideProgress,
}: {
  email: string;
  userId: number;
  avatar: string | null;
  showDot: boolean;
  onSettings: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onJoin: () => void;
  onFeedback: (() => void) | null;
  onWhatsNew: () => void;
  unseenRelease: boolean;
  onGuide: () => void;
  guideProgress: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState<LogoutScope | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const dotHint = useId();

  function toggle() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.right });
    setOpen((v) => !v);
  }

  // the menu item is gone once the menu closes, so a dialog opened from it hands focus back here
  function pick(fn: () => void) {
    setOpen(false);
    triggerRef.current?.focus();
    fn();
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          aria-label="your menu"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-describedby={showDot ? dotHint : undefined}
          className="flex p-1.5"
        >
          <span role="img" aria-label="your avatar" className="flex">
            <PersonAvatar userId={userId} avatar={avatar} size={32} />
          </span>
        </button>
        {showDot && <NewDot className="absolute top-1 right-1" />}
        <span id={dotHint} hidden>
          something new inside
        </span>
      </div>

      {confirmLogout && (
        <LogoutConfirm
          scope={confirmLogout}
          onConfirm={() => {
            clearSignedInState();
            void (confirmLogout === "everywhere" ? logoutEverywhereAction() : logoutAction());
          }}
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
              <div className="text-muted-foreground border-border font-ui mb-1 max-w-64 truncate border-b px-3 pt-0.5 pb-1.5 text-xs">
                {email}
              </div>
              <MenuItem onClick={() => pick(onSettings)} className="gap-2.5 py-2">
                <Icon name="sliders" />
                tweaks
              </MenuItem>
              <MenuItem onClick={() => pick(onJoin)} className="gap-2.5 py-2">
                <Icon name="user-plus" />
                <span>
                  join a bucket
                  <BetaTag feature="sharing" />
                </span>
              </MenuItem>
              <MenuItem onClick={() => pick(onArchive)} className="gap-2.5 py-2">
                <Icon name="archive" />
                archived
              </MenuItem>
              <MenuItem onClick={() => pick(onTrash)} className="gap-2.5 py-2">
                <Icon name="trash" />
                trash
              </MenuItem>
              {onFeedback && (
                <MenuItem onClick={() => pick(onFeedback)} className="gap-2.5 py-2">
                  <Icon name="message" />
                  feedback
                </MenuItem>
              )}
              <MenuItem onClick={() => pick(onWhatsNew)} className="gap-2.5 py-2">
                <Icon name="megaphone" />
                what&apos;s new
                {unseenRelease && (
                  <>
                    <NewDot />
                    <span className="sr-only">(new)</span>
                  </>
                )}
              </MenuItem>
              <MenuItem onClick={() => pick(onGuide)} className="gap-2.5 py-2">
                <Icon name="map" />
                getting started
                <span className="text-muted-foreground">{guideProgress}</span>
              </MenuItem>
              <div className="border-border my-1 border-t" />
              <MenuItem
                tone="destructive"
                onClick={() => pick(() => setConfirmLogout("here"))}
                className="gap-2.5 py-2"
              >
                <Icon name="logout" />
                logout
              </MenuItem>
              <MenuItem
                tone="destructive"
                onClick={() => pick(() => setConfirmLogout("everywhere"))}
                className="gap-2.5 py-2"
              >
                <Icon name="logout" />
                logout everywhere
              </MenuItem>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export function Header({
  email,
  userId,
  avatar,
  onSettingsOpen,
  onArchiveOpen,
  onTrashOpen,
  onJoinOpen,
  onFeedbackOpen,
  onWhatsNewOpen,
  unseenRelease,
  onGuideOpen,
  guideProgress,
  guideUnfinished,
}: HeaderProps) {
  return (
    <header className="max-w-column mx-auto flex w-full items-center justify-end px-3 pt-2">
      <GlobalMenu
        email={email}
        userId={userId}
        avatar={avatar}
        showDot={unseenRelease || guideUnfinished}
        onSettings={onSettingsOpen}
        onArchive={onArchiveOpen}
        onTrash={onTrashOpen}
        onJoin={onJoinOpen}
        onFeedback={onFeedbackOpen}
        onWhatsNew={onWhatsNewOpen}
        unseenRelease={unseenRelease}
        onGuide={onGuideOpen}
        guideProgress={guideProgress}
      />
    </header>
  );
}
