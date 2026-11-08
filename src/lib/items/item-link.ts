export function itemLink(path: string): { bucketId: number | null; itemId: number } | null {
  const url = new URL(path, "http://app");
  const item = /^#item-(\d+)$/.exec(url.hash);
  if (url.pathname !== "/" || !item) return null;
  const bucket = url.searchParams.get("bucket");
  return {
    bucketId: bucket && /^\d+$/.test(bucket) ? Number(bucket) : null,
    itemId: Number(item[1]),
  };
}
