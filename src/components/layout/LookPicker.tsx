"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { useLook } from "@/components/looks/LookProvider";
import { setLookAction } from "@/app/(app)/actions";
import { LABEL, LOOK_OPTIONS } from "./settings-constants";

export function LookPicker() {
  const look = useLook();
  const [pending, startTransition] = useTransition();

  function pick(next: string) {
    startTransition(async () => {
      const result = await setLookAction(next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL}>look</label>
      <OptionGroup options={LOOK_OPTIONS} value={look} onChange={pick} disabled={pending} />
    </div>
  );
}
