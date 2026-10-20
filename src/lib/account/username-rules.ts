import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_RESERVED,
  USERNAME_RESERVED_PREFIX,
} from "./constants";

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function usernameProblem(name: string): string | null {
  if (name.length < USERNAME_MIN_LENGTH) {
    return `a username needs at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (name.length > USERNAME_MAX_LENGTH) {
    return `a username can be at most ${USERNAME_MAX_LENGTH} characters`;
  }
  if (!/^[a-z0-9_]+$/.test(name)) return "only letters, numbers and _";
  if (USERNAME_RESERVED.includes(name) || name.startsWith(USERNAME_RESERVED_PREFIX)) {
    return "that username is reserved";
  }
  return null;
}
