import { clearSyncData } from "@/lib/sync/client/store";
import { useChatStore } from "./chat";
import { useDraftStore } from "./drafts";

export function clearSignedInState() {
  useDraftStore.getState().clearAll();
  useChatStore.getState().clearChat();
  void clearSyncData();
}
