"use client";

import { useOptimistic, useTransition } from "react";
import { notify } from "@/components/ui/notify";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { TextButton } from "@/components/ui/TextButton";
import { useLook } from "@/components/looks/LookProvider";
import { LookPreview } from "@/components/looks/LookPreview";
import type { Look } from "@/components/looks/constants";
import { setLookAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import { ACCENT_BUTTONS, LOOK_OPTIONS } from "./settings-constants";

type LookPickerDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function LookPickerDialog({ open, onClose }: LookPickerDialogProps) {
  const look = useLook();
  const [shown, setShown] = useOptimistic(look);
  const [, startTransition] = useTransition();

  function pick(next: Look) {
    startTransition(async () => {
      setShown(next);
      const result = await setLookAction(next);
      if (!result.ok) notify.error(result.error);
    });
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div
        className={cn(
          "border-border bg-background rounded-panel border-frame flex flex-col overflow-hidden",
          ACCENT_BUTTONS
        )}
      >
        <ModalHeader title="pick a look" onClose={onClose} />
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-muted-foreground font-ui text-2xs leading-tight">
            same app, two looks. you can switch any time in tweaks → appearance.
          </p>
          <OptionGroup options={LOOK_OPTIONS} value={shown} onChange={pick} />
          <LookPreview look={shown} />
        </div>
        <div className="border-border flex justify-end border-t px-3 py-2.5">
          <TextButton onClick={onClose}>done</TextButton>
        </div>
      </div>
    </Modal>
  );
}
