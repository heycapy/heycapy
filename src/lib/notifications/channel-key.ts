import type { NotificationMedium } from "./queue";

// one webhook is one channel: two webhooks must not share a failure or a history entry
export function channelKey(channel: { medium: NotificationMedium; webhookId: number | null }) {
  return channel.medium === "webhook" ? `webhook:${channel.webhookId}` : channel.medium;
}
