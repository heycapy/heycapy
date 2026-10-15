import { describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAvatarAction, saveAvatarAction } from "@/app/(app)/account-actions";
import { buildAccountExport } from "@/lib/account/export";
import { seedUser } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => (session.userId ? session : null),
}));

const DRAWING = "8".repeat(16) + ".".repeat(240);

async function storedAvatar(userId: number) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user?.avatar;
}

describe("avatar", () => {
  it("saves a drawing on the signed-in person and reads it back", async () => {
    session.userId = await seedUser();
    expect(await getAvatarAction()).toEqual({ ok: true, avatar: null });

    expect(await saveAvatarAction(DRAWING)).toEqual({ ok: true, avatar: DRAWING });
    expect(await getAvatarAction()).toEqual({ ok: true, avatar: DRAWING });
  });

  it("only ever changes the signed-in person's avatar", async () => {
    const other = await seedUser();
    session.userId = await seedUser();
    await saveAvatarAction(DRAWING);
    expect(await storedAvatar(other)).toBeNull();
  });

  it("rejects anything that isn't 256 palette codes", async () => {
    session.userId = await seedUser();
    for (const bad of ["8".repeat(255), "8".repeat(257), "z".repeat(256), "<svg/>".repeat(43)]) {
      expect(await saveAvatarAction(bad)).toMatchObject({ ok: false });
    }
    expect(await storedAvatar(session.userId)).toBeNull();
  });

  it("stores an empty drawing and a removal as no avatar", async () => {
    session.userId = await seedUser();
    await saveAvatarAction(DRAWING);
    expect(await saveAvatarAction(".".repeat(256))).toEqual({ ok: true, avatar: null });
    expect(await storedAvatar(session.userId)).toBeNull();

    await saveAvatarAction(DRAWING);
    expect(await saveAvatarAction(null)).toEqual({ ok: true, avatar: null });
    expect(await storedAvatar(session.userId)).toBeNull();
  });

  it("needs a session", async () => {
    session.userId = 0;
    expect(await saveAvatarAction(DRAWING)).toEqual({ ok: false, error: "Unauthorized" });
    expect(await getAvatarAction()).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("is part of the person's data export", async () => {
    session.userId = await seedUser();
    await saveAvatarAction(DRAWING);
    const data = await buildAccountExport(session.userId);
    expect(data.account.avatar).toBe(DRAWING);
  });
});
