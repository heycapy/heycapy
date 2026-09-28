import { ItemsRules, NotificationRules } from "@/types/rules";

function parseJson(raw: string | null | undefined): Record<string, unknown> {
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseNotificationRules(raw: string | null | undefined): NotificationRules {
  const parsed = NotificationRules.safeParse(parseJson(raw));
  return parsed.success ? parsed.data : NotificationRules.parse({});
}

export function bucketChannels(raw: string | null | undefined): NotificationRules["medium"] {
  return parseNotificationRules(raw).medium;
}

export function parseItemsRules(raw: string | null | undefined): Partial<ItemsRules> {
  const json = parseJson(raw);
  const set = {
    ...json,
    ...(json.sort_by !== undefined && { sortBy: json.sortBy ?? json.sort_by }),
  };
  const parsed = ItemsRules.safeParse(set);
  if (!parsed.success) return {};
  return Object.fromEntries(
    Object.entries(parsed.data).filter(([key]) => key in set)
  ) as Partial<ItemsRules>;
}
