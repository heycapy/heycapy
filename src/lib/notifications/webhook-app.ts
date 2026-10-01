import { DISCORD_CONTENT_MAX_LENGTH } from "@/constants";

export type WebhookEvent = {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
};

// discord and slack reject plain json, so their urls get each app's own message format
export function chatWebhookApp(url: string): "discord" | "slack" | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    /^(?:(?:ptb|canary)\.)?discord(?:app)?\.com$/.test(host) &&
    parsed.pathname.startsWith("/api/webhooks/")
  ) {
    return "discord";
  }
  if (host === "hooks.slack.com") return "slack";
  return null;
}

export function webhookBody(url: string, event: WebhookEvent, text: string): string {
  const app = chatWebhookApp(url);
  if (app === "discord") {
    // item titles are user text: an @everyone in one must not ping the whole server
    return JSON.stringify({
      content: text.slice(0, DISCORD_CONTENT_MAX_LENGTH),
      allowed_mentions: { parse: [] },
    });
  }
  if (app === "slack") {
    return JSON.stringify({
      text: text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    });
  }
  return JSON.stringify(event);
}
