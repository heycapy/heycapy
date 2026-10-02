import path from "node:path";

export const APP_SPECS_DIR = path.join(__dirname, "..", "app");
const AUTH_DIR = path.join(__dirname, "..", ".auth");

export function specUserEmail(spec: string): string {
  return `e2e-${spec}@heycapy.test`;
}

export function authState(spec: string): string {
  return path.join(AUTH_DIR, `${spec}.json`);
}
