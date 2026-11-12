import { KEYBIND_CLASHES, SUGGESTED_PREFIXES } from "./constants";
import type { KeybindClash, Prefix } from "./constants";
import { samePrefix } from "./match";

export function clashesFor(prefix: Prefix, isMac: boolean): KeybindClash[] {
  if (prefix.shift) return [];
  const platform = isMac ? "mac" : "pc";
  return KEYBIND_CLASHES.filter(
    (c) =>
      c.platform === platform &&
      c.key === prefix.key &&
      c.ctrl === prefix.ctrl &&
      c.meta === prefix.meta &&
      c.alt === prefix.alt
  );
}

export function describeClash(clash: KeybindClash, label: string): string {
  const verb = clash.source.includes(" and ") ? "use" : "uses";
  return `${clash.source} ${verb} ${label} to ${clash.action}, so heycapy may not get it.`;
}

export function suggestedPrefixes(current: Prefix, isMac: boolean): Prefix[] {
  return SUGGESTED_PREFIXES[isMac ? "mac" : "pc"].filter(
    (p) => !samePrefix(p, current) && clashesFor(p, isMac).length === 0
  );
}
