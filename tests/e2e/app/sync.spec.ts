import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  addMonthlyItemDueToday,
  createAndSelectBucket,
  inlineEditor,
  itemRow,
  itemTick,
  openEditForm,
  selectBucket,
  serverState,
  serverStates,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("sync") });
test.describe.configure({ mode: "default" });

const UNREACHABLE = /\/api\/(events|v1\/sync\/)/;
const reconnect = (pages: { evaluate: (fn: () => unknown) => Promise<unknown> }[]) =>
  Promise.all(pages.map((p) => p.evaluate(() => window.dispatchEvent(new Event("online")))));

test("an edit made without a connection reaches the server when it is back", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Offline edit"));
  const title = uniqueName("call plumber");
  await addItem(page, title);
  await expect.poll(() => serverState(page, title)).toBe("active");

  await page.route(UNREACHABLE, (route) => route.abort());
  const renamed = uniqueName("call the plumber");
  await openEditForm(page, title);
  await inlineEditor(page).getByRole("textbox", { name: "title" }).fill(renamed);
  await page.keyboard.press("Enter");
  await expect(itemRow(page, renamed)).toBeVisible();
  await expect(itemRow(page, title)).toHaveCount(0);

  await page.unroute(UNREACHABLE);
  await reconnect([page]);
  await expect.poll(() => serverState(page, renamed)).toBe("active");
  await expect.poll(() => serverState(page, title)).toBeNull();
});

test("two tabs show the same list without the server, and only one of them sends", async ({
  context,
  page,
}) => {
  await page.goto("/");
  const bucket = uniqueName("Two tabs");
  await createAndSelectBucket(page, bucket);
  const second = await context.newPage();
  await second.goto("/");
  await selectBucket(second, bucket);

  const pushes: string[] = [];
  // Only calls that got an answer: the ones the blocked connection cut off do not count
  context.on("requestfinished", (request) => {
    if (request.url().includes("/api/v1/sync/push")) pushes.push(request.postData() ?? "");
  });
  await context.route(UNREACHABLE, (route) => route.abort());

  const title = uniqueName("water plants");
  await addItem(second, title);
  await expect(itemRow(page, title)).toBeVisible();
  await itemTick(page, title).click();
  await expect(itemTick(second, title)).toBeChecked();

  await context.unroute(UNREACHABLE);
  await reconnect([page, second]);
  await expect.poll(() => serverState(page, title)).toBe("completed");

  // However many tabs, the server was told of the create in one call, never in two
  const creates = pushes.filter((body) => body.includes('"item.create"') && body.includes(title));
  expect(creates).toHaveLength(1);
});

test("a repeating item ticked without a connection gets its next date once the server hears", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Offline repeat"));
  const title = uniqueName("pay rent");
  await addMonthlyItemDueToday(page, title);
  await expect.poll(() => serverStates(page, title)).toEqual(["active"]);

  await page.route(UNREACHABLE, (route) => route.abort());
  await itemTick(page, title).click();
  await expect(itemTick(page, title)).toBeChecked();

  await page.unroute(UNREACHABLE);
  await reconnect([page]);
  await expect.poll(() => serverStates(page, title)).toEqual(["active", "completed"]);
  await expect(itemTick(page, title).and(page.locator("[aria-checked=false]"))).toHaveCount(1);
});
