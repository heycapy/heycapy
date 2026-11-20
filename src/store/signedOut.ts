import { clearSnapshots } from "@/lib/offline/snapshot";
import { useChatStore } from "./chat";
import { useDraftStore } from "./drafts";

export function clearSignedInState() {
  useDraftStore.getState().clearAll();
  useChatStore.getState().clearChat();
  void clearSnapshots();
}
