import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItem, createAndSelectBucket, itemRow, itemTick, uniqueName } from "../helpers/buckets";
import { field, openSettings, option, saveSettings, expectSelected } from "../helpers/settings";
import { enableWebhook, postItem } from "../helpers/webhook";
import { touchSwipe } from "../helpers/touch";

test.use({ storageState: authState("tick") });

test("the tick box finishes an item, and again reopens it", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Tick"));
  const title = uniqueName("water plants");
  await addItem(page, title);

  const tick = itemTick(page, title);
  await expect(tick).not.toBeChecked();
  await tick.click();
  await expect(tick).toBeChecked();
  await tick.click();
  await expect(tick).not.toBeChecked();
});

test("the tick box answers before the save comes back, and a done title isn't crossed out", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Quick tick"));
  const title = uniqueName("water plants");
  await addItem(page, title);

  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"]) await held;
    await route.fallback();
  });
  const tick = itemTick(page, title);
  await tick.click();
  await expect(tick).toBeChecked({ timeout: 1000 });
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect(itemRow(page, title).getByText(title)).toHaveCSS("text-decoration-line", "none");
});

test("a tick that doesn't save goes back and says so", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Failed tick"));
  const title = uniqueName("call bank");
  await addItem(page, title);

  await page.route("**/*", (route) =>
    route.request().headers()["next-action"] ? route.abort() : route.fallback()
  );
  const tick = itemTick(page, title);
  await tick.click();
  await expect(page.getByText("couldn't save that, try again")).toBeVisible();
  await expect(tick).not.toBeChecked();
});

test('ticking plays the picked sound, unticking and "off" stay quiet', async ({ page }) => {
  await page.addInitScript(() => {
    const started: number[] = [];
    Object.assign(window, { tickNotes: started });
    const tone = AudioContext.prototype.createOscillator;
    const pluck = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      started.push(Date.now());
      return tone.call(this);
    };
    AudioContext.prototype.createBufferSource = function (this: AudioContext) {
      started.push(Date.now());
      return pluck.call(this);
    };
  });
  const notes = () =>
    page.evaluate(() => (window as unknown as { tickNotes: number[] }).tickNotes.length);

  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Sound"));
  const title = uniqueName("feed cat");
  await addItem(page, title);
  const tick = itemTick(page, title);

  await tick.click();
  await expect(tick).toBeChecked();
  expect(await notes()).toBe(2);
  await tick.click();
  await expect(tick).not.toBeChecked();
  expect(await notes()).toBe(2);

  const tweaks = page.getByRole("dialog", { name: "tweaks" });
  const sound = field(tweaks, "tick sound");
  async function openTweaks() {
    await page.getByRole("button", { name: "your menu", exact: true }).click();
    await page.getByRole("button", { name: "tweaks", exact: true }).click();
  }

  await openTweaks();
  await option(sound, "harp").click();
  await expect.poll(notes).toBe(6);
  await option(sound, "off").click();
  await expectSelected(option(sound, "off"));
  await page.keyboard.press("Escape");
  await tick.click();
  await expect(tick).toBeChecked();
  expect(await notes()).toBe(6);

  await page.reload();
  await openTweaks();
  await expectSelected(option(sound, "off"));
  await option(sound, "chime").click();
  await expectSelected(option(sound, "chime"));
});

test("a read-only bucket's tick box can't be pressed", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Read only"));
  const title = uniqueName("read me");
  await addItem(page, title);
  const settings = await openSettings(page);
  await option(field(settings, "read only"), "on").click();
  await saveSettings(settings);

  await expect(itemTick(page, title)).toBeDisabled();
});

test("ticking an item in today takes it off the list", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Tick today"));
  const webhook = await enableWebhook(page);
  const title = uniqueName("call bank");
  const today = new Date().toLocaleDateString("en-CA");
  expect((await postItem(page.request, webhook, { title, deadline: today })).status()).toBe(201);
  await page.getByRole("button", { name: "today", exact: true }).click();

  const region = page.getByRole("region", { name: "today" });
  await region.getByRole("checkbox", { name: title, exact: true }).click();
  await expect(region.getByRole("button", { name: title })).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true });

  test("swiping a row either way does nothing", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "touch is driven through Chrome DevTools");
    await page.goto("/");
    await createAndSelectBucket(page, uniqueName("No swipe"));
    const title = uniqueName("water plants");
    await addItem(page, title);

    await touchSwipe(page, itemRow(page, title), 150);
    await expect(itemTick(page, title)).not.toBeChecked();
    await touchSwipe(page, itemRow(page, title), -150);
    await expect(page.getByRole("button", { name: "[ delete ]", exact: true })).toHaveCount(0);
    await expect(itemRow(page, title)).toBeVisible();
  });
});
