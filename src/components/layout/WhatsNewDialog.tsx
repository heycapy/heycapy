import { Modal, ModalHeader } from "@/components/ui/Modal";
import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import { CHANGELOG_URL, RELEASES, RELEASES_SHOWN } from "@/lib/whats-new/constants";

type WhatsNewDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function WhatsNewDialog({ open, onClose }: WhatsNewDialogProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div
        className={cn(
          "border-border bg-background flex max-h-[75dvh] flex-col overflow-hidden border-2",
          ACCENT_BUTTONS
        )}
      >
        <ModalHeader title="what's new" onClose={onClose} />
        <div className="flex flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4">
          {RELEASES.slice(0, RELEASES_SHOWN).map((release) => (
            <section
              key={release.version}
              aria-label={release.version}
              className="flex flex-col gap-3"
            >
              <h2 className="font-pixel text-muted-foreground text-xs">{release.version}</h2>
              {release.notes.map((note) => (
                <div key={note.title} className="flex flex-col gap-1">
                  <h3 className="text-foreground font-mono text-xs">{note.title}</h3>
                  <p className="text-muted-foreground font-mono text-[11px] leading-snug">
                    {note.text}
                  </p>
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-2">
          <p className="text-muted-foreground font-mono text-[11px] leading-tight">
            older releases and every detail are on github
          </p>
          <a
            href={CHANGELOG_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center py-1 font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>all changes<span className="opacity-50">]</span>
          </a>
        </div>
      </div>
    </Modal>
  );
}
