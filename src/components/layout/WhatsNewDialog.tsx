import { SidePanel } from "@/components/ui/SidePanel";
import { TextButton } from "@/components/ui/TextButton";
import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import { CHANGELOG_URL, RELEASES, RELEASES_SHOWN } from "@/lib/whats-new/constants";

type WhatsNewDialogProps = {
  open: boolean;
  onClose: () => void;
  onShowGuide: () => void;
};

export function WhatsNewDialog({ open, onClose, onShowGuide }: WhatsNewDialogProps) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="what's new"
      narrow="dialog"
      className={cn(ACCENT_BUTTONS)}
    >
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4">
        {RELEASES.slice(0, RELEASES_SHOWN).map((release) => (
          <section
            key={release.version}
            aria-label={release.version}
            className="flex flex-col gap-3"
          >
            <h2 className="font-display text-muted-foreground text-xs">{release.version}</h2>
            {release.notes.map((note) => (
              <div key={note.title} className="flex flex-col gap-1">
                <h3 className="text-foreground font-ui text-xs">{note.title}</h3>
                <p className="text-muted-foreground font-ui text-2xs leading-snug">{note.text}</p>
                {note.showGuide && (
                  <TextButton onClick={onShowGuide} className="self-start">
                    show me
                  </TextButton>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-2">
        <p className="text-muted-foreground font-ui text-2xs leading-tight">
          older releases and every detail are on github
        </p>
        <a
          href={CHANGELOG_URL}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground font-ui inline-flex shrink-0 items-center py-1 text-xs transition-colors"
        >
          <span className="opacity-50">[</span>all changes<span className="opacity-50">]</span>
        </a>
      </div>
    </SidePanel>
  );
}
