import path from "node:path";

export const APP_SPECS_DIR = path.join(__dirname, "..", "app");
const AUTH_DIR = path.join(__dirname, "..", ".auth");

/** Email of the user owning a spec in tests/e2e/app — one user per spec keeps files isolated. */
export function specUserEmail(spec: string): string {
  return `e2e-${spec}@heycapy.test`;
}

/** Saved login state for a spec in tests/e2e/app, created by global-setup. */
export function authState(spec: string): string {
  return path.join(AUTH_DIR, `${spec}.json`);
}
