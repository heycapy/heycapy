import { useChatStore } from "./chat";
import { useDraftStore } from "./drafts";

// Chat and drafts live in the browser tab, not the account: whoever signs in next in this tab
// mustn't see them. Setting them empty also overwrites what's saved in the tab
export function clearSignedInState() {
  useDraftStore.getState().clearAll();
  useChatStore.getState().clearChat();
}
