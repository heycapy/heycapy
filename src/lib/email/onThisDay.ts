import { z } from "zod";
import { APP_DOMAIN, APP_NAME, ON_THIS_DAY_API_BASE, ON_THIS_DAY_TIMEOUT_MS } from "@/constants";
import packageJson from "../../../package.json";

export type OnThisDay = { year: number; text: string; url: string | null };

const Feed = z.object({
  selected: z.array(
    z.object({
      text: z.string(),
      year: z.number(),
      pages: z
        .array(z.object({ content_urls: z.object({ desktop: z.object({ page: z.url() }) }) }))
        .default([]),
    })
  ),
});

// NOTE: wikimedia blocks clients that don't say who they are and how to reach them
const USER_AGENT = `${APP_NAME}/${packageJson.version} (https://${APP_DOMAIN})`;

// The list only changes once a day, so one fetch serves every email sent that day
let cached: { day: string; events: OnThisDay[] } | null = null;

async function eventsOn(day: string): Promise<OnThisDay[]> {
  if (cached?.day === day) return cached.events;
  const res = await fetch(`${ON_THIS_DAY_API_BASE}/${day}`, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(ON_THIS_DAY_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const feed = Feed.safeParse(await res.json());
  if (!feed.success) return [];
  const events = feed.data.selected.map((e) => ({
    year: e.year,
    text: e.text,
    url: e.pages[0]?.content_urls.desktop.page ?? null,
  }));
  if (events.length > 0) cached = { day, events };
  return events;
}

export async function onThisDay(now = new Date()): Promise<OnThisDay | null> {
  const day = `${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}`;
  try {
    const events = await eventsOn(day);
    return events.length > 0 ? events[Math.floor(Math.random() * events.length)] : null;
  } catch {
    return null;
  }
}

export function resetOnThisDayCache() {
  cached = null;
}
