import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { field, openSettings, option, saveSettings } from "../helpers/settings";
import { daysFromNow, enableWebhook, postItem, type Webhook } from "../helpers/webhook";

test.use({ storageState: authState("ordering") });
test.describe.configure({ mode: "default" });

type Seed = { title: string; deadline?: string };

let webhook: Webhook;
let stamp: string;

function title(name: string): string {
  return `${name} ${stamp}`;
}

async function seed(page: Page, items: Seed[]): Promise<void> {
  for (const item of items) {
    const res = await postItem(page.request, webhook, item);
    expect(res.status()).toBe(201);
  }
  for (const item of items) await expect(itemRow(page, item.title)).toBeVisible();
}

/** Titles of the seeded items in the order they are rendered. */
async function renderedOrder(page: Page): Promise<string[]> {
  const texts = await page.getByRole("button").filter({ hasText: stamp }).allInnerTexts();
  return texts.map((t) => t.split("\n")[0].trim());
}

async function setSort(page: Page, sort: "deadline" | "created" | "manual", drag = false) {
  const settings = await openSettings(page);
  await option(field(settings, "sort by"), sort).click();
  if (sort === "manual") await option(field(settings, "allow drag"), drag ? "on" : "off").click();
  await saveSettings(settings);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  stamp = `s${Date.now()}`;
  await createAndSelectBucket(page, uniqueName("Ordering Test"));
  webhook = await enableWebhook(page);
});

test("created sort lists items in the order they were added", async ({ page }) => {
  await seed(page, [
    { title: title("alpha"), deadline: daysFromNow(5) },
    { title: title("bravo") },
    { title: title("charlie"), deadline: daysFromNow(1) },
  ]);
  await setSort(page, "created");
  await expect
    .poll(() => renderedOrder(page))
    .toEqual([title("alpha"), title("bravo"), title("charlie")]);
});

test("deadline sort puts the soonest first and undated items last", async ({ page }) => {
  await seed(page, [
    { title: title("later"), deadline: daysFromNow(5) },
    { title: title("undated") },
    { title: title("soonest"), deadline: daysFromNow(1) },
    { title: title("middle"), deadline: daysFromNow(3) },
  ]);
  await setSort(page, "deadline");
  await expect
    .poll(() => renderedOrder(page))
    .toEqual([title("soonest"), title("middle"), title("later"), title("undated")]);

  await page.reload();
  await expect
    .poll(() => renderedOrder(page))
    .toEqual([title("soonest"), title("middle"), title("later"), title("undated")]);
});

test("drag handles only appear for manual sort with drag enabled", async ({ page }) => {
  await seed(page, [{ title: title("only") }]);
  const handle = page.getByRole("button", { name: "drag to reorder" });

  await setSort(page, "manual", false);
  await expect(handle).toHaveCount(0);

  await setSort(page, "manual", true);
  await expect(handle).toHaveCount(1);

  await setSort(page, "created");
  await expect(handle).toHaveCount(0);
});

test("dragging reorders items and the order survives a reload", async ({ page }) => {
  await seed(page, [{ title: title("one") }, { title: title("two") }, { title: title("three") }]);
  await setSort(page, "manual", true);
  await expect
    .poll(() => renderedOrder(page))
    .toEqual([title("one"), title("two"), title("three")]);

  const handles = page.getByRole("button", { name: "drag to reorder" });
  const from = await handles.nth(2).boundingBox();
  const to = await handles.nth(0).boundingBox();
  if (!from || !to) throw new Error("drag handles not rendered");

  // reorderItemsAction(bucketId, orderedIds) is posted when the drag ends
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.request().headers()["next-action"] !== undefined &&
      /^\[\d+,\[[\d,]+\]\]$/.test(r.request().postData() ?? "")
  );
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y - 4, { steps: 20 });
  await page.mouse.up();
  await saved;

  const dragged = [title("three"), title("one"), title("two")];
  await expect.poll(() => renderedOrder(page)).toEqual(dragged);

  await page.reload();
  await expect.poll(() => renderedOrder(page)).toEqual(dragged);
});
