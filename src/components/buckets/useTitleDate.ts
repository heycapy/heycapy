import { useRef } from "react";
import type { InlineDraft } from "@/lib/items/edit-draft";
import { findTitleDate } from "@/lib/items/title-date";
import type { InlineDraftState } from "./useInlineDraft";

export function useTitleDate(state: InlineDraftState, datePicked: boolean) {
  const pickedByHand = useRef(datePicked);
  const before = useRef<string | null>(null);

  function update(next: InlineDraft) {
    const current = state.draftRef.current;
    if (!pickedByHand.current && next.title !== current.title) {
      const found = findTitleDate(next.title);
      if (found) {
        if (before.current === null) before.current = current.deadline;
        next = { ...next, deadline: found.deadline };
      } else if (before.current !== null) {
        next = { ...next, deadline: before.current };
        before.current = null;
      }
    }
    state.update(next);
  }

  function byHand<Args extends unknown[]>(pick: (...args: Args) => void) {
    return (...args: Args) => {
      pickedByHand.current = true;
      before.current = null;
      pick(...args);
    };
  }

  function titleToAdd(title: string) {
    return pickedByHand.current ? title : (findTitleDate(title)?.title ?? title);
  }

  return {
    state: {
      ...state,
      update,
      pickDay: byHand(state.pickDay),
      pickClock: byHand(state.pickClock),
    },
    titleToAdd,
  };
}
