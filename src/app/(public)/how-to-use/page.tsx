"use client";

import { useState } from "react";
import Link from "next/link";

type DetailItem =
  | { type: "text"; text: string }
  | { type: "step"; text: string }
  | { type: "code"; text: string }
  | { type: "tip"; text: string };

type Feature = {
  title: string;
  desc: string;
  where: string;
  detail: DetailItem[];
};

const FEATURES: Feature[] = [
  {
    title: "buckets",
    desc: "organize anything into lists. pick a template or start blank.",
    where: "home → [add bucket]",
    detail: [
      {
        type: "text",
        text: "buckets are top-level containers. each one is its own list with independent settings.",
      },
      {
        type: "step",
        text: "pick a template (blank, ci/cd monitor, etc.) or start fresh and name it anything.",
      },
      {
        type: "step",
        text: "drag the tab bar to reorder. archive buckets you don't need right now.",
      },
      {
        type: "step",
        text: "each bucket has its own sort order, readonly mode, and show/hide completed toggle.",
      },
      {
        type: "tip",
        text: "deleted buckets go to trash — restore them anytime from the header menu.",
      },
    ],
  },
  {
    title: "items",
    desc: "add tasks with titles, deadlines, and optional recurring schedules.",
    where: "inside any bucket",
    detail: [
      {
        type: "text",
        text: "items have a title, optional deadline, status, and optional recurring config.",
      },
      { type: "step", text: "click any item to edit it. enter to save, escape to cancel." },
      { type: "step", text: "items on hold get no reminders until you change their status." },
      { type: "step", text: "custom schema fields show up as extra inputs in the item editor." },
      {
        type: "tip",
        text: "items added via webhook show a source badge so you know where they came from.",
      },
    ],
  },
  {
    title: "notifications",
    desc: "email, ntfy push, or telegram per bucket. offsets, quiet hours, repeat.",
    where: "bucket settings → notifications",
    detail: [
      { type: "text", text: "each bucket picks its own channels independently." },
      {
        type: "step",
        text: "remind-before offset: get notified X mins/hours/days before the deadline.",
      },
      {
        type: "step",
        text: "notify at: notifications won't fire before this time even if the trigger already passed.",
      },
      {
        type: "step",
        text: "quiet hours: no notifications fire within this window (e.g. 22:00 to 08:00).",
      },
      {
        type: "step",
        text: "deadline repeat: once, or re-send every day until item is completed.",
      },
      { type: "step", text: "notify on arrival: fires every time a new item lands via webhook." },
      {
        type: "tip",
        text: "notify when overdue: fires after deadline passes without completion. set a repeat interval (15min, 1h, etc.).",
      },
    ],
  },
  {
    title: "webhooks",
    desc: 'every bucket has a url + key. post {"title": "..."} from anywhere.',
    where: "bucket settings → advanced",
    detail: [
      { type: "text", text: "every bucket gets a unique url and key. rotate the key anytime." },
      { type: "step", text: 'minimum payload: {"title": "your item"}' },
      {
        type: "step",
        text: 'optional: "deadline" (ISO datetime), "status" ("active" / "completed" / "on hold")',
      },
      {
        type: "code",
        text: 'curl -X POST https://app.heycapy.xyz/api/webhook/ID \\\n  -H "Authorization: Bearer KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"title": "deploy failed"}\'',
      },
      {
        type: "tip",
        text: "if the bucket has a custom schema, include those fields too — they get validated on arrival.",
      },
    ],
  },
  {
    title: "ai chat",
    desc: "capy lives bottom-right. add items, parse deadlines, ask things.",
    where: "bottom-right corner",
    detail: [
      {
        type: "text",
        text: "capy can add items, parse natural language deadlines, and answer questions about your buckets.",
      },
      { type: "step", text: "ctrl+\\ to toggle the chat open/closed." },
      { type: "step", text: "configure your provider in settings → tweaks → ai provider." },
      { type: "step", text: "supported: ollama (local), openai, anthropic, groq, gemini." },
      {
        type: "tip",
        text: "chat history is saved — access it via the history icon in the chat header.",
      },
    ],
  },
  {
    title: "voice input",
    desc: "tap the mic in capy chat. transcribed via openai whisper.",
    where: "capy chat → mic icon",
    detail: [
      { type: "text", text: "tap the mic to start recording. tap again or hit stop when done." },
      {
        type: "step",
        text: "the recording is transcribed via openai whisper and dropped into the chat.",
      },
      { type: "step", text: "requires an openai api key with whisper access in settings." },
      {
        type: "tip",
        text: "keyboard shortcut: ctrl+shift+m to toggle recording without touching the mouse.",
      },
    ],
  },
  {
    title: "bucket schema",
    desc: "define custom fields per bucket. text, number, select, date.",
    where: "bucket settings → advanced → schema",
    detail: [
      {
        type: "text",
        text: "schema attaches structured data to every item beyond just title and deadline.",
      },
      { type: "step", text: "field types: text, number, select (with options), date, boolean." },
      {
        type: "step",
        text: "fields appear in the item editor and can be marked required or optional.",
      },
      {
        type: "tip",
        text: "webhook payloads are validated against the schema — missing required fields get rejected with a clear error.",
      },
    ],
  },
  {
    title: "smtp",
    desc: "bring your own email server. host, port, user, password.",
    where: "settings → tweaks → smtp",
    detail: [
      { type: "text", text: "swap the default email provider for any smtp server you control." },
      { type: "step", text: "fields: host, port, username, password, from address." },
      {
        type: "step",
        text: "works with gmail app passwords, protonmail bridge, mailgun, postmark smtp, or any relay.",
      },
      {
        type: "tip",
        text: "test the connection from settings after saving — sends a test email to confirm it works.",
      },
    ],
  },
  {
    title: "telegram bot",
    desc: "connect telegram for notifications and adding items from chat.",
    where: "settings → tweaks → telegram",
    detail: [
      { type: "text", text: "heycapy has its own telegram bot. no need to create one." },
      { type: "step", text: "go to settings → tweaks → telegram and follow the connect steps." },
      { type: "step", text: "message @heycapybot on telegram to link your account." },
      {
        type: "step",
        text: "once connected, buckets with telegram enabled will push reminders directly to you.",
      },
      {
        type: "tip",
        text: "per-bucket config (shortcuts, time slots, deadline buttons) is in bucket settings → notifications → configure telegram.",
      },
    ],
  },
  {
    title: "recurring items",
    desc: "set daily, weekly, monthly, or yearly repeat on any item.",
    where: "item editor → recurring",
    detail: [
      {
        type: "text",
        text: "recurring items auto-create the next occurrence after the current one is notified.",
      },
      { type: "step", text: "open any item, toggle recurring on, set frequency and interval." },
      { type: "step", text: "optionally set an end date — recurrence stops after that." },
      {
        type: "step",
        text: "the original item stays as-is. the next one is always created as active.",
      },
      {
        type: "tip",
        text: "great for bills, check-ins, maintenance tasks, or anything on a regular schedule.",
      },
    ],
  },
];

function FeatureDialog({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="border-border bg-background relative z-10 flex w-full max-w-sm flex-col border-2"
        style={{ boxShadow: "4px 4px 0 var(--border)" }}
      >
        <div className="bg-foreground text-background flex items-center justify-between px-3 py-2">
          <span className="font-pixel text-xs">{feature.title}</span>
          <button
            onClick={onClose}
            className="font-mono text-xs opacity-60 transition-opacity hover:opacity-100"
          >
            <span className="opacity-50">[</span>x<span className="opacity-50">]</span>
          </button>
        </div>

        <div className="border-border border-b px-3 py-1.5">
          <span className="text-muted-foreground font-mono text-[9px]">find it: </span>
          <span className="font-mono text-[9px]">{feature.where}</span>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto p-4">
          {feature.detail.map((item, i) => {
            if (item.type === "code") {
              return (
                <pre
                  key={i}
                  className="border-border bg-card border p-2.5 font-mono text-[9px] leading-relaxed break-all whitespace-pre-wrap"
                >
                  {item.text}
                </pre>
              );
            }
            if (item.type === "step") {
              return (
                <div key={i} className="flex gap-2.5">
                  <span className="text-muted-foreground/50 mt-[3px] shrink-0 font-mono text-[9px]">
                    ▸
                  </span>
                  <p className="text-muted-foreground font-mono text-[11px] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              );
            }
            if (item.type === "tip") {
              return (
                <div key={i} className="border-border bg-card border-l-2 py-1.5 pr-2 pl-3">
                  <p className="text-muted-foreground font-mono text-[10px] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              );
            }
            return (
              <p key={i} className="font-mono text-[11px] leading-relaxed">
                {item.text}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HowToUsePage() {
  const [active, setActive] = useState<Feature | null>(null);

  return (
    <main className="flex flex-1 flex-col items-center p-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-pixel text-sm">how to use</h1>
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>back<span className="opacity-50">]</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-border flex flex-col gap-2 border p-3">
              <p className="font-pixel text-[11px]">{f.title}</p>
              <p className="text-muted-foreground flex-1 font-mono text-[10px] leading-relaxed">
                {f.desc}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setActive(f)}
                  className="text-muted-foreground hover:text-foreground font-mono text-[10px] transition-colors"
                >
                  <span className="opacity-50">[</span>more<span className="opacity-50">]</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-border mt-8 flex gap-4 border-t pt-5">
          <a
            href="https://github.com/heycapy/heycapy"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>github<span className="opacity-50">]</span>
          </a>
          <Link
            href="/about"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>about<span className="opacity-50">]</span>
          </Link>
          <a
            href="https://app.heycapy.xyz"
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            <span className="opacity-50">[</span>open app<span className="opacity-50">]</span>
          </a>
        </div>
      </div>

      {active && <FeatureDialog feature={active} onClose={() => setActive(null)} />}
    </main>
  );
}
