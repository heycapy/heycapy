import { DEFAULT_PREFIX_KEY, KEYBIND_ACTIONS } from "./constants";
import type { KeybindActionId } from "./constants";

export type Prefix = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

export type KeyEventLike = {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

export type KeyBindings = Record<KeybindActionId, string>;

const DIGIT_CODE = /^(?:Digit|Numpad)([1-9])$/;
const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift", "AltGraph", "OS"]);

export function defaultPrefix(isMac: boolean): Prefix {
  return {
    key: DEFAULT_PREFIX_KEY,
    ctrl: !isMac,
    meta: isMac,
    alt: false,
    shift: false,
  };
}

export function defaultBindings(): KeyBindings {
  return Object.fromEntries(KEYBIND_ACTIONS.map((a) => [a.id, a.key])) as KeyBindings;
}

export function mergeBindings(overrides: Partial<KeyBindings>): KeyBindings {
  const bindings = defaultBindings();
  for (const action of KEYBIND_ACTIONS) {
    const key = overrides[action.id];
    if (action.rebindable && key) bindings[action.id] = key;
  }
  return bindings;
}

export function normalizeKey(e: KeyEventLike): string | null {
  const digit = DIGIT_CODE.exec(e.code);
  if (digit) return digit[1];
  if (e.key.length !== 1) return null;
  return e.key.toLowerCase();
}

export function matchesPrefix(e: KeyEventLike, prefix: Prefix): boolean {
  return (
    normalizeKey(e) === prefix.key &&
    e.ctrlKey === prefix.ctrl &&
    e.metaKey === prefix.meta &&
    e.altKey === prefix.alt &&
    e.shiftKey === prefix.shift
  );
}

export function resolveAction(e: KeyEventLike, bindings: KeyBindings): KeybindActionId | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const key = normalizeKey(e);
  if (!key) return null;
  const match = KEYBIND_ACTIONS.find((a) => bindings[a.id] === key);
  return match?.id ?? null;
}

export function prefixFromEvent(e: KeyEventLike): Prefix | null {
  if (isModifierKey(e)) return null;
  if (!e.ctrlKey && !e.metaKey && !e.altKey) return null;
  const key = normalizeKey(e);
  if (!key) return null;
  return { key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey };
}

export function findConflict(
  bindings: KeyBindings,
  actionId: KeybindActionId,
  key: string
): KeybindActionId | null {
  const other = KEYBIND_ACTIONS.find((a) => a.id !== actionId && bindings[a.id] === key);
  return other?.id ?? null;
}

export function formatKey(key: string): string {
  return key === " " ? "Space" : key;
}

export function formatPrefix(prefix: Prefix, isMac: boolean): string {
  const parts = [
    prefix.ctrl && "Ctrl",
    prefix.alt && (isMac ? "Option" : "Alt"),
    prefix.shift && "Shift",
    prefix.meta && (isMac ? "Cmd" : "Win"),
    prefix.key.length === 1 && prefix.key !== " "
      ? prefix.key.toUpperCase()
      : formatKey(prefix.key),
  ];
  return parts.filter(Boolean).join("+");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !("tagName" in target)) return false;
  const el = target as HTMLElement;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable === true
  );
}

export function isModifierKey(e: Pick<KeyEventLike, "key">): boolean {
  return MODIFIER_KEYS.has(e.key);
}
