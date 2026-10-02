import { useCallback, useMemo, useState } from "react";
import { findTitleDate, type TitleDate } from "@/lib/items/title-date";

function findUnlessDismissed(title: string, dismissed: string | null): TitleDate | null {
  const found = findTitleDate(title);
  return found && title.slice(found.start, found.end) !== dismissed ? found : null;
}

// A date typed into a new item's title fills in "when"; a date set with the picker wins over typing
export function useTitleDate({
  active,
  title,
  deadline,
  onDeadlineChange,
}: {
  active: boolean;
  title: string;
  deadline: string;
  onDeadlineChange: (deadline: string) => void;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [pickedByHand, setPickedByHand] = useState(false);
  // What "when" held before typing took over, so it comes back when the words are deleted
  const [before, setBefore] = useState<string | null>(null);

  const listening = active && !pickedByHand;
  const match = useMemo(
    () => (listening ? findUnlessDismissed(title, dismissed) : null),
    [listening, title, dismissed]
  );

  function giveBack() {
    if (before === null) return;
    onDeadlineChange(before);
    setBefore(null);
  }

  function typed(next: string) {
    if (!listening) return;
    const found = findUnlessDismissed(next, dismissed);
    if (!found) {
      giveBack();
      return;
    }
    if (before === null) setBefore(deadline);
    if (found.deadline !== deadline) onDeadlineChange(found.deadline);
  }

  function dismiss() {
    if (!match) return;
    setDismissed(title.slice(match.start, match.end));
    giveBack();
  }

  function pickByHand() {
    setPickedByHand(true);
    setBefore(null);
  }

  const reset = useCallback(() => {
    setDismissed(null);
    setPickedByHand(false);
    setBefore(null);
  }, []);

  return { match, typed, dismiss, pickByHand, reset };
}
