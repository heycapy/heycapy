import { KEYBIND_ACTION } from "@/lib/keybinds/constants";
import type { KeybindActionId } from "@/lib/keybinds/constants";
import { isTypingTarget } from "@/lib/keybinds/match";
import { bucketAt, currentPlace, stepPlace } from "@/lib/keybinds/navigate";
import type { Place } from "@/lib/keybinds/navigate";
import { useUIStore } from "@/store/ui";
import { useLayoutStore } from "@/store/layout";

const HIDDEN_IN_FOCUS: KeybindActionId[] = [
  KEYBIND_ACTION.today,
  KEYBIND_ACTION.search,
  KEYBIND_ACTION.capy,
  KEYBIND_ACTION.mic,
];
const BUCKET_NUMBER_ACTION = /^bucket-([1-9])$/;
const CHAT_SELECTOR = "[data-capy-chat]";
const DIALOG_SELECTOR = '[role="dialog"]';

type KeybindActionsOptions = {
  canDock: boolean;
  openTweaks: () => void;
};

function goTo(place: Place | null) {
  if (place === null) return;
  const ui = useUIStore.getState();
  if (place === "today") ui.openToday();
  else ui.setActiveBucketId(place);
}

function here() {
  const ui = useUIStore.getState();
  const { bucketOrder } = useLayoutStore.getState();
  return { ui, bucketOrder, place: currentPlace(bucketOrder, ui.activeBucketId, ui.todayOpen) };
}

export function keybindActions({ canDock, openTweaks }: KeybindActionsOptions) {
  function toggleChat() {
    const { chatState, setChatState } = useLayoutStore.getState();
    if (chatState === "closed" || chatState === "minimized") setChatState("open");
    else setChatState(canDock ? "closed" : "minimized");
  }

  function onAction(id: KeybindActionId) {
    const bucketNumber = BUCKET_NUMBER_ACTION.exec(id);
    if (bucketNumber) {
      return goTo(bucketAt(here().bucketOrder, Number(bucketNumber[1])));
    }
    const { ui, bucketOrder, place } = here();
    if (ui.focusMode && HIDDEN_IN_FOCUS.includes(id)) return;
    switch (id) {
      case KEYBIND_ACTION.quickAdd:
        return ui.requestAddItem(false);
      case KEYBIND_ACTION.addWithDetails:
        return ui.requestAddItem(true);
      case KEYBIND_ACTION.previousBucket:
        return goTo(stepPlace(bucketOrder, place, -1));
      case KEYBIND_ACTION.nextBucket:
        return goTo(stepPlace(bucketOrder, place, 1));
      case KEYBIND_ACTION.today:
        return ui.openToday();
      case KEYBIND_ACTION.search:
        return useLayoutStore.getState().setSearchOpen(true);
      case KEYBIND_ACTION.capy:
        return toggleChat();
      case KEYBIND_ACTION.mic: {
        const { chatState, requestMic } = useLayoutStore.getState();
        if (chatState === "open" || chatState === "fullscreen") requestMic();
        return;
      }
      case KEYBIND_ACTION.bucketSettings:
        if (place !== "today") ui.requestBucketSettings(place);
        return;
      case KEYBIND_ACTION.focus:
        return ui.setFocusMode(!ui.focusMode);
      case KEYBIND_ACTION.tweaks:
        return openTweaks();
      case KEYBIND_ACTION.cheatSheet: {
        const { cheatSheetOpen, setCheatSheetOpen } = useLayoutStore.getState();
        return setCheatSheetOpen(!cheatSheetOpen);
      }
    }
  }

  function onEscape(e: KeyboardEvent) {
    const { chatState } = useLayoutStore.getState();
    if (chatState !== "open" && chatState !== "fullscreen") return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && !target.closest(CHAT_SELECTOR)) {
      if (isTypingTarget(target) || target.closest(DIALOG_SELECTOR)) return;
    }
    useLayoutStore.getState().setChatState("closed");
  }

  return { onAction, onEscape };
}
