import { useCallback, useState } from "react";
import { TextButton } from "@/components/ui/TextButton";

type SaveBarProps = {
  pending: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

export function SaveBar({ pending, onSave, onDiscard }: SaveBarProps) {
  return (
    <div className="border-border bg-background border-t-frame flex items-center justify-between gap-2 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <span className="text-muted-foreground font-ui text-xs">unsaved changes</span>
      <div className="flex gap-3">
        <TextButton onClick={onDiscard} disabled={pending}>
          discard
        </TextButton>
        <TextButton onClick={onSave} disabled={pending} className="text-foreground">
          {pending ? "saving..." : "save"}
        </TextButton>
      </div>
    </div>
  );
}

type CloseWarningProps = {
  pending: boolean;
  // null when a new username is waiting: it uses up a change, so only its own button saves it
  onSave: (() => void) | null;
  onDiscard: () => void;
  onKeepEditing: () => void;
};

export function CloseWarning({ pending, onSave, onDiscard, onKeepEditing }: CloseWarningProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-label="unsaved changes"
        className="border-border bg-background rounded-panel border-frame shadow-raised-md flex w-full max-w-xs flex-col gap-3 p-4"
      >
        <p className="font-ui text-xs">
          {onSave
            ? "save your changes before closing?"
            : "your new username isn't saved yet. close and drop your changes?"}
        </p>
        <div className="flex flex-wrap gap-3">
          {onSave && (
            <TextButton onClick={onSave} disabled={pending} className="text-foreground">
              {pending ? "saving..." : "save"}
            </TextButton>
          )}
          <TextButton onClick={onDiscard} disabled={pending} variant="destructive">
            discard
          </TextButton>
          <TextButton onClick={onKeepEditing} disabled={pending}>
            keep editing
          </TextButton>
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
