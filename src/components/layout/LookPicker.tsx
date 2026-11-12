"use client";

import { LOOK } from "@/constants";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { useControlSize, useLook } from "@/components/looks/LookProvider";
import { setControlSizeAction, setLookAction } from "@/app/(app)/actions";
import { CONTROL_SIZE_OPTIONS, LABEL, LOOK_OPTIONS } from "./settings-constants";
import { useSaveSetting } from "./useSaveSetting";

export function LookPicker() {
  const look = useLook();
  const controlSize = useControlSize();
  const { pending, save } = useSaveSetting();

  return (
    <>
      <OptionGroup
        options={LOOK_OPTIONS}
        value={look}
        onChange={(value) => save(setLookAction, value)}
        disabled={pending}
      />
      {look === LOOK.modern && (
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>button size</label>
          <OptionGroup
            options={CONTROL_SIZE_OPTIONS}
            value={controlSize}
            onChange={(value) => save(setControlSizeAction, value)}
            disabled={pending}
          />
        </div>
      )}
    </>
  );
}
