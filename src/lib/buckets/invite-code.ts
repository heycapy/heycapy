import { INVITE_CODE_LENGTH } from "./constants";

export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatInviteCode(input: string): string {
  const code = normalizeInviteCode(input).slice(0, INVITE_CODE_LENGTH);
  const half = INVITE_CODE_LENGTH / 2;
  return code.length > half ? `${code.slice(0, half)}-${code.slice(half)}` : code;
}
