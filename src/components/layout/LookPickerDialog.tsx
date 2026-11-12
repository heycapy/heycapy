"use client";

import { useOptimistic, useTransition } from "react";
import { useTheme } from "next-themes";
import { notify } from "@/components/ui/notify";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { TextButton } from "@/components/ui/TextButton";
import { useLook } from "@/components/looks/LookProvider";
import { LookPreview } from "@/components/looks/LookPreview";
import type { Look } from "@/components/looks/constants";
import { setLookAction } from "@/app/(app)/actions";
import { pickedThemeAction } from "@/app/(app)/guide-actions";
import { cn } from "@/lib/utils";
import { ACCENT_BUTTONS, LABEL, LOOK_OPTIONS } from "./settings-constants";
import { ThemeSwatches } from "./ThemeSwatches";

type LookPickerDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function LookPickerDialog({ open, onClose }: LookPickerDialogProps) {
  const look = useLook();
  const [shown, setShown] = useOptimistic(look);
  const [, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();

  function pick(next: Look) {
    startTransition(async () => {
      setShown(next);
      const result = await setLookAction(next);
      if (!result.ok) notify.error(result.error);
    });
  }

  function pickTheme(next: string) {
    setTheme(next);
    void pickedThemeAction();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div
        className={cn(
          "border-border bg-background rounded-panel border-frame flex max-h-[calc(92dvh-1.5rem)] flex-col overflow-hidden sm:max-h-[calc(88dvh-1.5rem)]",
          ACCENT_BUTTONS
        )}
      >
        <ModalHeader title="pick a look" onClose={onClose} />
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 py-4">
          <p className="text-muted-foreground font-ui text-2xs leading-tight">
            same app, two looks, and a theme for either. you can change both any time in tweaks →
            appearance.
          </p>
          <OptionGroup options={LOOK_OPTIONS} value={shown} onChange={pick} />
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>theme</label>
            <ThemeSwatches theme={theme} onPick={pickTheme} />
          </div>
          <LookPreview look={shown} />
        </div>
        <div className="border-border flex shrink-0 justify-end border-t px-3 py-2.5">
          <TextButton onClick={onClose}>done</TextButton>
        </div>
      </div>
    </Modal>
  );
}
