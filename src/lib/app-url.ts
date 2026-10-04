const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

export function isLocalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTNAMES.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function publicAppUrl(): string | null {
  const raw = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return raw && /^https?:\/\//.test(raw) ? raw : null;
}
