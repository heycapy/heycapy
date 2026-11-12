import { KEYBIND_ACTIONS } from "./constants";
import type { KeybindActionId } from "./constants";
import { findConflict, formatKey, mergeBindings, normalizeKey } from "./match";
import type { KeyEventLike, Prefix } from "./match";
import type { StoredKeybinds } from "./schema";

export type EditResult = { ok: true; stored: StoredKeybinds } | { ok: false; error: string };

function without<T extends object>(value: T, key: keyof T): T {
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== key)) as T;
}

export function withPrefix(stored: StoredKeybinds, prefix: Prefix | null): StoredKeybinds {
  const rest = without(stored, "prefix");
  return prefix ? { ...rest, prefix } : rest;
}

export function withHints(stored: StoredKeybinds, hints: boolean): StoredKeybinds {
  const rest = without(stored, "hints");
  return hints ? { ...rest, hints } : rest;
}

export function withBinding(
  stored: StoredKeybinds,
  actionId: KeybindActionId,
  e: KeyEventLike
): EditResult {
  const action = KEYBIND_ACTIONS.find((a) => a.id === actionId);
  if (!action?.rebindable) return { ok: false, error: "That key is fixed" };
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return { ok: false, error: "Use a plain key, the prefix is the one with Ctrl, Cmd or Alt" };
  }
  const key = normalizeKey(e);
  if (!key) return { ok: false, error: "Pick a letter, number or symbol key" };

  const bindings = mergeBindings(stored.bindings ?? {});
  const conflict = findConflict(bindings, actionId, key);
  if (conflict) {
    const other = KEYBIND_ACTIONS.find((a) => a.id === conflict);
    return { ok: false, error: `"${formatKey(key)}" is already ${other?.label ?? "used"}` };
  }

  const overrides = without(stored.bindings ?? {}, actionId);
  const next = key === action.key ? overrides : { ...overrides, [actionId]: key };
  const rest = without(stored, "bindings");
  return {
    ok: true,
    stored: Object.keys(next).length > 0 ? { ...rest, bindings: next } : rest,
  };
}

export function withoutBindings(stored: StoredKeybinds): StoredKeybinds {
  return without(stored, "bindings");
}
