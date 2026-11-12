import { KEYBIND_CLASHES } from "./constants";
import type { KeybindClash } from "./constants";
import type { Prefix } from "./match";

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
