import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import { CHANGELOG_URL, RELEASES } from "@/lib/whats-new/constants";

type WhatsNewDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function WhatsNewDialog({ open, onClose }: WhatsNewDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[55] bg-black"
            onClick={onClose}
          />
          <motion.div
            key="dialog"
            role="dialog"
            aria-label="what's new"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[8%] left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 shadow-[5px_5px_0_var(--border)] sm:top-[12%]"
          >
            <div
              className={cn(
                "border-border bg-background flex max-h-[75dvh] flex-col overflow-hidden border-2",
                ACCENT_BUTTONS
              )}
            >
              <div className="bg-foreground text-background flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="font-pixel text-xs">what&apos;s new</span>
                <BracketButton type="button" variant="inverted" onClick={onClose}>
                  x
                </BracketButton>
              </div>
              <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
                {RELEASES.map((release) => (
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
              <p className="border-border text-muted-foreground border-t px-4 py-2.5 font-mono text-[11px] leading-tight">
                this is the short version, every change is in the{" "}
                <a
                  href={CHANGELOG_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:text-foreground whitespace-nowrap underline"
                >
                  full changelog
                </a>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
