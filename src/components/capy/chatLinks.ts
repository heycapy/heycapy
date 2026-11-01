function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function appHref(
  href: string | undefined,
  pageOrigin: string,
  appUrl: string | null
): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, pageOrigin);
    const ours = [pageOrigin, appUrl && originOf(appUrl)];
    return ours.includes(url.origin) ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
