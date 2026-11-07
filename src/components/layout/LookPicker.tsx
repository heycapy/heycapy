"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { LOOK } from "@/constants";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { useControlSize, useLook } from "@/components/looks/LookProvider";
import { setControlSizeAction, setLookAction } from "@/app/(app)/actions";
import { CONTROL_SIZE_OPTIONS, LABEL, LOOK_OPTIONS } from "./settings-constants";

export function LookPicker() {
  const look = useLook();
  const controlSize = useControlSize();
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
    </>
  );
}
