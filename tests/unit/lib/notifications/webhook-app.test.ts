import { describe, expect, it } from "vitest";
import { chatWebhookApp, webhookBody } from "@/lib/notifications/webhook-app";

const event = { type: "test", timestamp: "2026-10-01T12:00:00.000Z", data: { message: "hi" } };

describe("chatWebhookApp", () => {
  it.each([
    ["https://discord.com/api/webhooks/1/abc", "discord"],
    ["https://canary.discord.com/api/webhooks/1/abc", "discord"],
    ["https://discordapp.com/api/webhooks/1/abc", "discord"],
    ["https://hooks.slack.com/services/T0/B0/x", "slack"],
    ["https://discord.com/channels/1", null],
    ["https://notdiscord.com/api/webhooks/1/abc", null],
    ["https://n8n.example.com/webhook/heycapy", null],
    ["not a url", null],
  ])("%s → %s", (url, app) => {
    expect(chatWebhookApp(url)).toBe(app);
  });
});

describe("webhookBody", () => {
  it("discord gets its text in content, without pinging anyone", () => {
    const body = JSON.parse(
      webhookBody("https://discord.com/api/webhooks/1/abc", event, "@everyone pay rent")
    );
    expect(body).toEqual({ content: "@everyone pay rent", allowed_mentions: { parse: [] } });
  });

  it("discord text is cut to its 2000 character limit", () => {
    const body = JSON.parse(
      webhookBody("https://discord.com/api/webhooks/1/abc", event, "a".repeat(2500))
    );
    expect(body.content).toHaveLength(2000);
  });

  it("slack gets its text in text, with its control characters escaped", () => {
    const body = JSON.parse(
      webhookBody("https://hooks.slack.com/services/T0/B0/x", event, "<!channel> R&D")
    );
    expect(body).toEqual({ text: "&lt;!channel&gt; R&amp;D" });
  });

  it("any other url gets the event itself", () => {
    expect(JSON.parse(webhookBody("https://example.com/hook", event, "ignored"))).toEqual(event);
  });
});
