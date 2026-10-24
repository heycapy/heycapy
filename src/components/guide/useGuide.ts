"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getGuideAction } from "@/app/(app)/actions";
import type { GuideState } from "@/lib/guide/guide";

function doneKeys(guide: GuideState): Set<string> {
  return new Set(guide.tasks.filter((task) => task.done).map((task) => task.key));
}

// The layout sends a fresh state after every change and opening the panel asks for one. Tasks that
// turn done while the app is open get a toast, ones done before it opened don't
export function useGuide(fromServer: GuideState) {
  const [guide, setGuide] = useState(fromServer);
  const [lastFromServer, setLastFromServer] = useState(fromServer);
  if (fromServer !== lastFromServer) {
    setLastFromServer(fromServer);
    setGuide(fromServer);
  }

  const announced = useRef(doneKeys(fromServer));
  useEffect(() => {
    for (const task of guide.tasks) {
      if (!task.done || announced.current.has(task.key)) continue;
      announced.current.add(task.key);
      toast(
        task.earned > 0 ? `${task.title} · +${task.earned} capy credits` : `done: ${task.title}`
      );
    }
  }, [guide]);

  async function refresh() {
    setGuide(await getGuideAction());
  }

  return { guide, refresh };
}
