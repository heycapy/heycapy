"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { notify } from "@/components/ui/notify";
import { getGuideAction, hideGuideAction } from "@/app/(app)/actions";
import type { GuideState } from "@/lib/guide/guide";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { HTTPS_ONLY_TASKS, KEYBOARD_ONLY_TASKS } from "./constants";

function doneKeys(guide: GuideState): Set<string> {
  return new Set(guide.tasks.filter((task) => task.done).map((task) => task.key));
}

export function doableTasks(guide: GuideState, secure: boolean, keyboard: boolean): GuideState {
  const skipped = [...(secure ? [] : HTTPS_ONLY_TASKS), ...(keyboard ? [] : KEYBOARD_ONLY_TASKS)];
  if (skipped.length === 0) return guide;
  return { ...guide, tasks: guide.tasks.filter((task) => !skipped.includes(task.key)) };
}

const subscribeNever = () => () => {};

// The layout sends a fresh state after every change and opening the panel asks for one. Tasks that
// turn done while the app is open get a toast, ones done before it opened don't
export function useGuide(fromServer: GuideState) {
  const [guide, setGuide] = useState(fromServer);
  const [lastFromServer, setLastFromServer] = useState(fromServer);
  if (fromServer !== lastFromServer) {
    setLastFromServer(fromServer);
    setGuide(fromServer);
  }
  const secure = useSyncExternalStore(
    subscribeNever,
    () => window.isSecureContext,
    () => true
  );

  const keyboard = useMediaQuery("(any-pointer: fine)");

  const announced = useRef(doneKeys(fromServer));
  useEffect(() => {
    for (const task of guide.tasks) {
      if (!task.done || announced.current.has(task.key)) continue;
      announced.current.add(task.key);
      notify.info(
        task.earned > 0 ? `${task.title} · +${task.earned} capy credits` : `done: ${task.title}`,
        { icon: "map" }
      );
    }
  }, [guide]);

  async function refresh() {
    setGuide(await getGuideAction());
  }

  function setHidden(hidden: boolean) {
    setGuide((current) => ({ ...current, hidden }));
    hideGuideAction(hidden).catch(() => {
      setGuide((current) => ({ ...current, hidden: !hidden }));
      notify.error("couldn't save that, try again");
    });
  }

  return { guide: doableTasks(guide, secure, keyboard), refresh, setHidden };
}
