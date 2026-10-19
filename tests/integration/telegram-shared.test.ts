import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items, userSettings } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import { getFlowState, setFlowState } from "@/app/api/telegram/telegram-utils";
import { TELEGRAM_BUCKET_GONE } from "@/lib/notifications/constants";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";
import {
  callsTo,
  connectOwnChat,
  say,
  stubTelegram,
  tap,
  type TelegramApi,
} from "./telegram-helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

type Button = { text: string; callback_data: string };
type Sent = { text: string; reply_markup?: { inline_keyboard: Button[][] } };

function lastMessage(api: TelegramApi): Sent {
  const calls = [...callsTo(api, "sendMessage"), ...callsTo(api, "editMessageText")];
  return calls[calls.length - 1] as unknown as Sent;
}

async function sharedBucket() {
  const api = stubTelegram();
  const owner = await seedUser();
  const member = await seedUser();
  const stranger = await seedUser();
  const bucketId = await seedBucket(owner);
  await db.update(buckets).set({ name: "Home" }).where(eq(buckets.id, bucketId));
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  const itemId = await seedItem(owner, bucketId, {
    deadline: new Date(T0.getTime() + HOUR),
    title: "book flights",
  });
  await seedItem(member, bucketId, {
    deadline: new Date(T0.getTime() + 2 * HOUR),
    title: "buy milk",
  });
  return {
    api,
    owner,
    member,
    stranger,
    bucketId,
    itemId,
    ownerChat: await connectOwnChat(owner),
    memberChat: await connectOwnChat(member),
    strangerChat: await connectOwnChat(stranger),
  };
}

async function itemOf(itemId: number) {
  const [row] = await db.select().from(items).where(eq(items.id, itemId));
  return row;
}

async function flowOf(userId: number) {
  const [row] = await db
    .select({ state: userSettings.telegramState })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return getFlowState(row?.state ?? null);
}

describe("a shared bucket on Telegram", () => {
  it("/buckets lists a joined bucket with everyone's open items", async () => {
    const { api, bucketId, memberChat } = await sharedBucket();

    await say("/buckets", memberChat);

    expect(lastMessage(api).reply_markup?.inline_keyboard).toEqual([
      [{ text: "Home  ·  2 items", callback_data: `lb:${bucketId}` }],
    ]);
  });

  it("lists show a member the owner's items, and show a stranger nothing", async () => {
    const { api, bucketId, memberChat, strangerChat } = await sharedBucket();

    await say("/list", memberChat);
    expect(lastMessage(api).text).toContain("book flights");
    expect(lastMessage(api).text).toContain("buy milk");

    await tap(`lb:${bucketId}`, memberChat);
    expect(lastMessage(api).text).toMatch(/^<b>Home<\/b>[\s\S]*book flights/);

    await tap(`lb:${bucketId}`, strangerChat);
    expect(lastMessage(api).text).not.toContain("book flights");
    expect(lastMessage(api).text).not.toContain("Home");
  });

  it("a member adds to a joined bucket with the buttons and with /add", async () => {
    const { api, member, bucketId, memberChat } = await sharedBucket();

    await tap(`ab:${bucketId}`, memberChat);
    await say("water plants", memberChat);
    await tap("ad:no_deadline", memberChat);
    await say("/add 1 call mom", memberChat);

    const added = await db.select().from(items).where(eq(items.userId, member));
    expect(added.map((i) => [i.title, i.bucketId])).toEqual([
      ["buy milk", bucketId],
      ["water plants", bucketId],
      ["call mom", bucketId],
    ]);
    expect(lastMessage(api).text).toBe('Added "call mom" to Home ✓');
  });

  it("a stranger can't start adding to someone else's bucket", async () => {
    const { stranger, bucketId, strangerChat } = await sharedBucket();

    await tap(`ab:${bucketId}`, strangerChat);

    expect(await flowOf(stranger)).toBeNull();
  });

  it("someone removed halfway through adding adds nothing", async () => {
    const { api, member, bucketId, memberChat } = await sharedBucket();

    await tap(`ab:${bucketId}`, memberChat);
    await say("water plants", memberChat);
    await db.delete(bucketMembers).where(eq(bucketMembers.userId, member));
    await tap("ad:no_deadline", memberChat);

    const titles = (await db.select().from(items).where(eq(items.bucketId, bucketId))).map(
      (i) => i.title
    );
    expect(titles).not.toContain("water plants");
    expect(lastMessage(api).text).toBe(TELEGRAM_BUCKET_GONE);
  });

  it("a member opens, renames and deletes the owner's item, and the others' screens hear of it", async () => {
    const { member, bucketId, itemId, memberChat } = await sharedBucket();
    const changed: number[] = [];
    const listener = (id: number) => changed.push(id);
    dataEvents.on("bucket", listener);

    try {
      await tap(`mi:${itemId}`, memberChat);
      await tap("me:rename", memberChat);
      await say("book trains", memberChat);
      expect((await itemOf(itemId))?.title).toBe("book trains");
      expect(changed).toContain(bucketId);

      await tap(`mi:${itemId}`, memberChat);
      await tap("la:delete", memberChat);
      await tap("dc:yes", memberChat);
    } finally {
      dataEvents.off("bucket", listener);
    }

    expect(await itemOf(itemId)).toMatchObject({ deletedAt: T0, deletedBy: member });
  });

  it("a stranger can't open, rename or delete an item", async () => {
    const { api, stranger, itemId, bucketId, strangerChat } = await sharedBucket();

    await tap(`mi:${itemId}`, strangerChat);
    expect(lastMessage(api).text).toBe("Item not found.");

    const edit = { itemId, itemTitle: "book flights", bucketId, bucketName: "Home" };
    await setFlowState(stranger, { s: "mg_edit_title", ...edit });
    await say("stolen", strangerChat);
    await setFlowState(stranger, { s: "mg_confirm", ...edit });
    await tap("dc:yes", strangerChat);

    expect(await itemOf(itemId)).toMatchObject({ title: "book flights", deletedAt: null });
  });

  it("a joined bucket's shortcut stays its owner's", async () => {
    const { api, member, bucketId, ownerChat, memberChat } = await sharedBucket();
    await db
      .update(buckets)
      .set({ telegramConfig: JSON.stringify({ alias: "home" }) })
      .where(eq(buckets.id, bucketId));

    await say("/help", ownerChat);
    expect(lastMessage(api).text).toContain("/home — add to Home");
    await say("/help", memberChat);
    expect(lastMessage(api).text).not.toContain("/home");

    await say("/home water plants", memberChat);
    expect(await flowOf(member)).toBeNull();
  });
});
