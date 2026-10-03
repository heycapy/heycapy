import { useCallback, useState } from "react";
import { BracketButton } from "@/components/ui/BracketButton";

type SaveBarProps = {
  pending: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

export function SaveBar({ pending, onSave, onDiscard }: SaveBarProps) {
  return (
    <div className="border-border bg-background flex items-center justify-between gap-2 border-t-2 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <span className="text-muted-foreground font-mono text-xs">unsaved changes</span>
      <div className="flex gap-3">
        <BracketButton onClick={onDiscard} disabled={pending}>
          discard
        </BracketButton>
        <BracketButton onClick={onSave} disabled={pending} className="text-foreground">
          {pending ? "saving..." : "save"}
        </BracketButton>
      </div>
    </div>
  );
}

type CloseWarningProps = {
  pending: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
};

export function CloseWarning({ pending, onSave, onDiscard, onKeepEditing }: CloseWarningProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-label="unsaved changes"
        className="border-border bg-background flex w-full max-w-xs flex-col gap-3 border-2 p-4"
        style={{ boxShadow: "4px 4px 0 var(--border)" }}
      >
        <p className="font-mono text-xs">save your changes before closing?</p>
        <div className="flex flex-wrap gap-3">
          <BracketButton onClick={onSave} disabled={pending} className="text-foreground">
            {pending ? "saving..." : "save"}
          </BracketButton>
          <BracketButton onClick={onDiscard} disabled={pending} variant="destructive">
            discard
          </BracketButton>
          <BracketButton onClick={onKeepEditing} disabled={pending}>
            keep editing
          </BracketButton>
        </div>
      </div>
    </div>
  );
}

export function useUnsavedChanges(current: string | null) {
  const [saved, setSaved] = useState<string | null>(null);
  if (current !== null && saved === null) setSaved(current);
  const reset = useCallback(() => setSaved(null), []);
  return {
    dirty: saved !== null && current !== null && current !== saved,
    reset,
    // a change already saved on the server, like connecting telegram, isn't an unsaved one
    keepSaved: (change: Record<string, unknown>) =>
      setSaved((prev) => prev && JSON.stringify({ ...JSON.parse(prev), ...change })),
  };
}
