import { describe, it, expect } from "vitest";
import {
  defaultBindings,
  defaultPrefix,
  findConflict,
  formatPrefix,
  isTypingTarget,
  matchesPrefix,
  mergeBindings,
  normalizeKey,
  prefixFromEvent,
  resolveAction,
} from "@/lib/keybinds/match";
import type { KeyEventLike } from "@/lib/keybinds/match";
import { BUCKET_NUMBERS, KEYBIND_ACTIONS } from "@/lib/keybinds/constants";

function press(key: string, init: Partial<KeyEventLike> = {}): KeyEventLike {
  return {
    key,
    code: "",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  };
}

describe("default bindings", () => {
  it("gives every action a unique key", () => {
    const keys = KEYBIND_ACTIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has one action per bucket number", () => {
    for (const n of BUCKET_NUMBERS) {
      expect(defaultBindings()[`bucket-${n}`]).toBe(String(n));
    }
  });
});

describe("matchesPrefix", () => {
  it("matches Ctrl+; off Mac and Cmd+; on Mac", () => {
    expect(matchesPrefix(press(";", { ctrlKey: true }), defaultPrefix(false))).toBe(true);
    expect(matchesPrefix(press(";", { metaKey: true }), defaultPrefix(true))).toBe(true);
  });

  it("does not match the wrong modifier, extra modifiers or a bare key", () => {
    const prefix = defaultPrefix(false);
    expect(matchesPrefix(press(";", { metaKey: true }), prefix)).toBe(false);
    expect(matchesPrefix(press(";", { ctrlKey: true, shiftKey: true }), prefix)).toBe(false);
    expect(matchesPrefix(press(";"), prefix)).toBe(false);
    expect(matchesPrefix(press("a", { ctrlKey: true }), prefix)).toBe(false);
  });
});

describe("normalizeKey", () => {
  it("lowercases letters and keeps punctuation as printed", () => {
    expect(normalizeKey(press("A"))).toBe("a");
    expect(normalizeKey(press("?", { shiftKey: true }))).toBe("?");
    expect(normalizeKey(press("/"))).toBe("/");
  });

  it("reads digits from the physical key so AZERTY works", () => {
    expect(normalizeKey(press("&", { code: "Digit1" }))).toBe("1");
    expect(normalizeKey(press("3", { code: "Numpad3" }))).toBe("3");
  });

  it("ignores named keys", () => {
    expect(normalizeKey(press("Enter"))).toBeNull();
    expect(normalizeKey(press("ArrowLeft"))).toBeNull();
  });
});

describe("resolveAction", () => {
  const bindings = defaultBindings();

  it("finds the action for a plain key", () => {
    expect(resolveAction(press("a"), bindings)).toBe("quick-add");
    expect(resolveAction(press("?", { shiftKey: true }), bindings)).toBe("cheat-sheet");
    expect(resolveAction(press("&", { code: "Digit4" }), bindings)).toBe("bucket-4");
  });

  it("is not case sensitive", () => {
    expect(resolveAction(press("A", { shiftKey: true }), bindings)).toBe("quick-add");
  });

  it("returns null for unbound keys and for keys held with ctrl, meta or alt", () => {
    expect(resolveAction(press("z"), bindings)).toBeNull();
    expect(resolveAction(press("a", { ctrlKey: true }), bindings)).toBeNull();
    expect(resolveAction(press("a", { metaKey: true }), bindings)).toBeNull();
    expect(resolveAction(press("a", { altKey: true }), bindings)).toBeNull();
  });

  it("follows a rebound key", () => {
    const rebound = mergeBindings({ "quick-add": "q" });
    expect(resolveAction(press("q"), rebound)).toBe("quick-add");
    expect(resolveAction(press("a"), rebound)).toBeNull();
  });
});

describe("mergeBindings", () => {
  it("ignores overrides for actions that cannot be rebound", () => {
    expect(mergeBindings({ "bucket-1": "x" })["bucket-1"]).toBe("1");
  });
});

describe("prefixFromEvent", () => {
  it("records a key held with a modifier", () => {
    expect(prefixFromEvent(press("b", { ctrlKey: true, shiftKey: true }))).toEqual({
      key: "b",
      ctrl: true,
      meta: false,
      alt: false,
      shift: true,
    });
  });

  it("rejects a bare key, shift alone, and a modifier press on its own", () => {
    expect(prefixFromEvent(press("b"))).toBeNull();
    expect(prefixFromEvent(press("B", { shiftKey: true }))).toBeNull();
    expect(prefixFromEvent(press("Control", { ctrlKey: true }))).toBeNull();
  });
});

describe("findConflict", () => {
  it("names the action already using a key and ignores the action itself", () => {
    const bindings = defaultBindings();
    expect(findConflict(bindings, "quick-add", "t")).toBe("today");
    expect(findConflict(bindings, "quick-add", "a")).toBeNull();
    expect(findConflict(bindings, "quick-add", "q")).toBeNull();
  });
});

describe("formatPrefix", () => {
  it("writes the modifiers in order", () => {
    expect(formatPrefix(defaultPrefix(false), false)).toBe("Ctrl+;");
    expect(formatPrefix(defaultPrefix(true), true)).toBe("Cmd+;");
    expect(formatPrefix({ key: "k", ctrl: true, meta: false, alt: true, shift: true }, false)).toBe(
      "Ctrl+Alt+Shift+K"
    );
  });
});

describe("isTypingTarget", () => {
  it("is true for fields and editable content", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(
      isTypingTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)
    ).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isTypingTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
