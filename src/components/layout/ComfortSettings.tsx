"use client";

import { OptionGroup } from "@/components/ui/OptionGroup";
import { Toggle } from "@/components/ui/Toggle";
import { useReduceMotion, useTextSize, useTickSound } from "@/components/looks/LookProvider";
import { setReduceMotionAction, setTextSizeAction, setTickSoundAction } from "@/app/(app)/actions";
import { playTickSound } from "@/lib/sounds/tick";
import { HINT, LABEL, TEXT_SIZE_OPTIONS, TICK_SOUND_OPTIONS } from "./settings-constants";
import { useSaveSetting } from "./useSaveSetting";

export function ComfortSettings() {
  const textSize = useTextSize();
  const reduceMotion = useReduceMotion();
  const tickSound = useTickSound();
  const { pending, save } = useSaveSetting();

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>text size</label>
        <OptionGroup
          options={TEXT_SIZE_OPTIONS}
          value={textSize}
          onChange={(value) => save(setTextSizeAction, value)}
          disabled={pending}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className={LABEL}>reduce motion</label>
          <Toggle
            label="reduce motion"
            value={reduceMotion}
            onChange={(value) => save(setReduceMotionAction, value)}
            disabled={pending}
          />
        </div>
        <span className={HINT}>no sliding, fading or popping anywhere in the app</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>tick sound</label>
        <OptionGroup
          options={TICK_SOUND_OPTIONS}
          value={tickSound}
          onChange={(sound) => {
            playTickSound(sound);
            save(setTickSoundAction, sound);
          }}
          disabled={pending}
        />
      </div>
    </>
  );
}
