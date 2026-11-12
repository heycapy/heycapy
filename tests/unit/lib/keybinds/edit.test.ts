import { describe, it, expect } from "vitest";
import { clashesFor } from "@/lib/keybinds/clashes";
import { withBinding, withHints, withoutBindings, withPrefix } from "@/lib/keybinds/edit";
import { defaultPrefix } from "@/lib/keybinds/match";
import type { KeyEventLike } from "@/lib/keybinds/match";
import { storedKeybindsSchema } from "@/lib/keybinds/schema";

function press(key: string, init: Partial<KeyEventLike> = {}): KeyEventLike {
  return { key, code: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init };
}

describe("withBinding", () => {
  it("stores a rebound key and passes the schema", () => {
    const result = withBinding({}, "quick-add", press("q"));
    expect(result).toEqual({ ok: true, stored: { bindings: { "quick-add": "q" } } });
    expect(result.ok && storedKeybindsSchema.safeParse(result.stored).success).toBe(true);
  });

  it("drops the override when the key goes back to the default", () => {
    const rebound = withBinding({ hints: true }, "quick-add", press("q"));
    if (!rebound.ok) throw new Error("expected ok");
    expect(withBinding(rebound.stored, "quick-add", press("a"))).toEqual({
      ok: true,
      stored: { hints: true },
    });
  });

  it("refuses a key another action uses, naming it", () => {
    expect(withBinding({}, "quick-add", press("t"))).toEqual({
      ok: false,
      error: '"t" is already today',
    });
  });

  it("refuses a bucket number key, a modifier combo, a named key and a fixed action", () => {
    expect(withBinding({}, "quick-add", press("&", { code: "Digit2" })).ok).toBe(false);
    expect(withBinding({}, "quick-add", press("q", { ctrlKey: true })).ok).toBe(false);
    expect(withBinding({}, "quick-add", press("Enter")).ok).toBe(false);
    expect(withBinding({}, "bucket-1", press("q")).ok).toBe(false);
  });

  it("lets two actions swap through a free key", () => {
    const first = withBinding({}, "quick-add", press("x"));
    if (!first.ok) throw new Error("expected ok");
    expect(withBinding(first.stored, "today", press("a")).ok).toBe(true);
  });
});

describe("the other edits", () => {
  const prefix = { key: "b", ctrl: true, meta: false, alt: false, shift: false };

  it("sets and clears the prefix", () => {
    expect(withPrefix({ hints: true }, prefix)).toEqual({ hints: true, prefix });
    expect(withPrefix({ hints: true, prefix }, null)).toEqual({ hints: true });
  });

  it("sets and clears the hints flag", () => {
    expect(withHints({}, true)).toEqual({ hints: true });
    expect(withHints({ hints: true }, false)).toEqual({});
  });

  it("clears every rebound key and keeps the rest", () => {
    expect(withoutBindings({ hints: true, bindings: { today: "x" } })).toEqual({ hints: true });
  });
});

describe("clashesFor", () => {
  it("names what a browser does with the combination", () => {
    const found = clashesFor(
      { key: "k", ctrl: true, meta: false, alt: false, shift: false },
      false
    );
    expect(found.map((c) => c.source)).toEqual(["Chrome", "Firefox"]);
  });

  it("flags Ctrl+Space on a Mac and Cmd+; for spell check, but not the PC default", () => {
    expect(
      clashesFor({ key: " ", ctrl: true, meta: false, alt: false, shift: false }, true)
    ).toHaveLength(1);
    expect(clashesFor(defaultPrefix(true), true).map((c) => c.source)).toEqual(["macOS"]);
    expect(clashesFor(defaultPrefix(false), false)).toEqual([]);
  });

  it("does not mix up platforms or shifted combinations", () => {
    expect(
      clashesFor({ key: "t", ctrl: true, meta: false, alt: false, shift: false }, true)
    ).toEqual([]);
    expect(
      clashesFor({ key: "t", ctrl: true, meta: false, alt: false, shift: true }, false)
    ).toEqual([]);
  });
});
