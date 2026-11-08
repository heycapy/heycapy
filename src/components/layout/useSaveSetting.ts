import { useTransition } from "react";
import { notify } from "@/components/ui/notify";
import type { ActionResult } from "@/types/result";

export function useSaveSetting() {
  const [pending, startTransition] = useTransition();

  function save<T>(action: (value: T) => Promise<ActionResult>, value: T) {
    startTransition(async () => {
      const result = await action(value);
      if (!result.ok) notify.error(result.error);
    });
  }

  return { pending, save };
}
