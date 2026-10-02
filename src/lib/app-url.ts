export function publicAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return raw && /^https?:\/\//.test(raw) ? raw : null;
}
