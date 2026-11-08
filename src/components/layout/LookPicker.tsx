"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { LOOK } from "@/constants";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { useControlSize, useLook, useTickSound } from "@/components/looks/LookProvider";
import { setControlSizeAction, setLookAction, setTickSoundAction } from "@/app/(app)/actions";
import { playTickSound } from "@/lib/tick-sound/play";
import {
  CONTROL_SIZE_OPTIONS,
  LABEL,
  LOOK_OPTIONS,
  TICK_SOUND_OPTIONS,
} from "./settings-constants";

export function LookPicker() {
  const look = useLook();
  const controlSize = useControlSize();
  const tickSound = useTickSound();
  const [pending, startTransition] = useTransition();

  function save(action: (value: string) => Promise<{ ok: boolean; error?: string }>) {
    return (value: string) =>
      startTransition(async () => {
        const result = await action(value);
        if (!result.ok) toast.error(result.error);
      });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>look</label>
        <OptionGroup
          options={LOOK_OPTIONS}
          value={look}
          onChange={save(setLookAction)}
          disabled={pending}
        />
      </div>
      {look === LOOK.modern && (
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>button size</label>
          <OptionGroup
            options={CONTROL_SIZE_OPTIONS}
            value={controlSize}
            onChange={save(setControlSizeAction)}
            disabled={pending}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>tick sound</label>
        <OptionGroup
          options={TICK_SOUND_OPTIONS}
          value={tickSound}
          onChange={(sound) => {
            playTickSound(sound);
            save(setTickSoundAction)(sound);
          }}
          disabled={pending}
        />
      </div>
    </>
  );
}
