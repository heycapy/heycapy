"use client";

import { Modal, ModalHeader } from "@/components/ui/Modal";
import { BracketButton } from "@/components/ui/BracketButton";
import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import type { GuideState, GuideTask } from "@/lib/guide/guide";

type GuidePanelProps = {
  open: boolean;
  guide: GuideState;
  onClose: () => void;
  onHint: (task: GuideTask) => void;
};

export function GuidePanel({ open, guide, onClose, onHint }: GuidePanelProps) {
  const doneCount = guide.tasks.filter((task) => task.done).length;
  const earned = guide.tasks.reduce((sum, task) => sum + task.earned, 0);
  const total = guide.tasks.reduce((sum, task) => sum + task.credits, 0);

  return (
    <Modal open={open} onClose={onClose}>
      <div
        className={cn(
          "border-border bg-background flex max-h-[75dvh] flex-col overflow-hidden border-2",
          ACCENT_BUTTONS
        )}
      >
        <ModalHeader title="getting started" onClose={onClose} />
        <div className="flex flex-col gap-1 border-b px-4 py-3">
          <p className="text-muted-foreground font-mono text-[11px] leading-snug">
            a few things to try. each one ticks itself once you&apos;ve done it
            {guide.paysCredits && " and gives you capy credits"}.
          </p>
          <div className="flex items-center justify-between gap-3 font-mono text-xs">
            <p className="text-foreground">
              {doneCount} of {guide.tasks.length} done
            </p>
            {guide.paysCredits && (
              <p className="text-primary" aria-label="credits earned">
                {earned} / {total} credits
              </p>
            )}
          </div>
        </div>
        <ul className="flex flex-col overflow-y-auto overscroll-contain px-4 py-2">
          {guide.tasks.map((task) => {
            // a done task shows what it paid, which can differ from its price on older accounts
            const credits = !guide.paysCredits ? 0 : task.done ? task.earned : task.credits;
            return (
              <li
                key={task.key}
                aria-label={task.title}
                data-done={task.done}
                className="flex min-h-9 items-center gap-3 font-mono text-xs"
              >
                <span
                  aria-hidden
                  className={cn(
                    "w-3 shrink-0",
                    task.done ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {task.done ? "✓" : "·"}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    task.done ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {task.title}
                </span>
                {credits > 0 && (
                  <span
                    className={cn("shrink-0", task.done ? "text-muted-foreground" : "text-primary")}
                  >
                    +{credits}
                  </span>
                )}
                {!task.done && (
                  <BracketButton onClick={() => onHint(task)} className="shrink-0">
                    hint
                  </BracketButton>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
