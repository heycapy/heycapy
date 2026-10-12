// Where login may send someone afterwards; anything else would be an open redirect
const JOIN_PATH = /^\/join\/[A-Za-z0-9]{1,64}$/;

export function safeNextPath(raw: string | null): string {
  return raw && JOIN_PATH.test(raw) ? raw : "/";
}
