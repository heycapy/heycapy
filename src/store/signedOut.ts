import { clearSnapshots } from "@/lib/offline/snapshot";
import { clearSyncData } from "@/lib/sync/client/store";
import { useChatStore } from "./chat";
import { useDraftStore } from "./drafts";

export function clearSignedInState() {
  useDraftStore.getState().clearAll();
  useChatStore.getState().clearChat();
  void clearSnapshots();
  void clearSyncData();
}
