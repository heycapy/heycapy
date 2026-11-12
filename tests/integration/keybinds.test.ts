import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveKeybindsAction } from "@/app/(app)/user-settings-actions";
import { keybindsFor } from "@/lib/keybinds/load";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { seedUser } from "./helpers";

let userId = 0;
let signedIn = true;
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (signedIn ? { userId } : null),
  deleteSession: async () => {},
}));

beforeEach(async () => {
  userId = await seedUser();
  signedIn = true;
});

describe("saving keybinds", () => {
  it("starts empty, so every default applies", async () => {
    expect(await keybindsFor(userId)).toEqual({});
  });

  it("stores a prefix, a rebound key and the hints toggle", async () => {
    const stored = {
      prefix: { key: "b", ctrl: true, meta: false, alt: false, shift: true },
      bindings: { "quick-add": "q" },
      hints: true,
    };
    expect(await saveKeybindsAction(stored)).toEqual({ ok: true });
    expect(await keybindsFor(userId)).toEqual(stored);
  });

  it("refuses a prefix with no Ctrl, Cmd or Alt", async () => {
    const result = await saveKeybindsAction({
      prefix: { key: "b", ctrl: false, meta: false, alt: false, shift: true },
    });
    expect(result.ok).toBe(false);
  });

  it("refuses two actions on one key, including a bucket number key", async () => {
    expect((await saveKeybindsAction({ bindings: { today: "a" } })).ok).toBe(false);
    expect((await saveKeybindsAction({ bindings: { today: "3" } })).ok).toBe(false);
  });

  it("refuses an action that cannot be rebound, an unknown action and a long key", async () => {
    expect((await saveKeybindsAction({ bindings: { "bucket-1": "x" } })).ok).toBe(false);
    expect((await saveKeybindsAction({ bindings: { nope: "x" } })).ok).toBe(false);
    expect((await saveKeybindsAction({ bindings: { today: "xy" } })).ok).toBe(false);
  });

  it("keeps the saved keys when a later save is refused", async () => {
    await saveKeybindsAction({ hints: true });
    await saveKeybindsAction({ bindings: { today: "a" } });
    expect(await keybindsFor(userId)).toEqual({ hints: true });
  });

  it("needs a session", async () => {
    signedIn = false;
    expect(await saveKeybindsAction({ hints: true })).toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("falls back to defaults when the stored value is corrupt", async () => {
    await db
      .update(userSettings)
      .set({ keybinds: { bindings: { today: "a" } } })
      .where(eq(userSettings.userId, userId));
    expect(await keybindsFor(userId)).toEqual({});
  });
});
