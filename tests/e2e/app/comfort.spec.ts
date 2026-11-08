import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  bucketTab,
  createAndSelectBucket,
  itemRow,
  itemRowContainer,
  selectBucket,
  uniqueName,
} from "../helpers/buckets";
import { expectSelected, field, option } from "../helpers/settings";

test.use({ storageState: authState("comfort") });
test.describe.configure({ mode: "serial" });

async function openTweaks(page: Page) {
  await page.getByRole("button", { name: "your menu", exact: true }).click();
  await page.getByRole("button", { name: "tweaks", exact: true }).click();
  return page.getByRole("dialog", { name: "tweaks" });
}

async function expectAfterReload(page: Page, motion: "reduce" | null) {
  await expect(async () => {
    await page.reload();
    const html = page.locator("html");
    if (motion) await expect(html).toHaveAttribute("data-motion", motion, { timeout: 1000 });
    else await expect(html).not.toHaveAttribute("data-motion", /./, { timeout: 1000 });
  }).toPass();
}

test("larger text makes every text bigger and stays after a reload", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Text"));
  const title = uniqueName("pay rent");
  await addItem(page, title);
  const text = itemRow(page, title).getByText(title);
  const size = async () => parseFloat(await text.evaluate((el) => getComputedStyle(el).fontSize));
  const before = await size();

  const tweaks = await openTweaks(page);
  await option(field(tweaks, "text size"), "larger").click();
  await expect(page.locator("html")).toHaveAttribute("data-text", "larger");
  await expect.poll(size).toBeCloseTo(before * 1.25, 1);

  await page.reload();
  await expect.poll(size).toBeCloseTo(before * 1.25, 1);
  await expectSelected(option(field(await openTweaks(page), "text size"), "larger"));
  await option(field(tweaks, "text size"), "default").click();
  await expect.poll(size).toBeCloseTo(before, 1);
});

test("reduce motion stops transitions everywhere and stays after a reload", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Motion"));
  const title = uniqueName("water plants");
  await addItem(page, title);
  const row = itemRowContainer(page, title);
  const durations = () => row.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(await durations()).toBe("1s, 0.3s");

  const motion = field(await openTweaks(page), "reduce motion");
  await option(motion, "on").click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await expect.poll(durations).toBe("1e-05s");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await expect.poll(durations).toBe("1e-05s");
  await option(field(await openTweaks(page), "reduce motion"), "off").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-motion", "reduce");
  await expect.poll(durations).toBe("1s, 0.3s");
});

test("reduce motion switches at once while it saves", async ({ page }) => {
  await page.goto("/");
  const motion = field(await openTweaks(page), "reduce motion");
  await expect(option(motion, "on")).toBeVisible();
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"]) await held;
    await route.continue();
  });

  await option(motion, "on").click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await expectSelected(option(motion, "on"));
  await expect(option(motion, "off")).toBeEnabled();

  release();
  await page.unrouteAll({ behavior: "wait" });
  await expectAfterReload(page, "reduce");

  await option(field(await openTweaks(page), "reduce motion"), "off").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-motion", "reduce");
  await expectAfterReload(page, null);
});

test("with reduce motion a bucket switch swaps the list without a blank or a fade", async ({
  page,
}) => {
  await page.goto("/");
  const first = uniqueName("Still A");
  await createAndSelectBucket(page, first);
  const cat = uniqueName("feed cat");
  await addItem(page, cat);
  const second = uniqueName("Still B");
  await createAndSelectBucket(page, second);
  const milk = uniqueName("buy milk");
  await addItem(page, milk);

  await option(field(await openTweaks(page), "reduce motion"), "on").click();
  await expectAfterReload(page, "reduce");
  await selectBucket(page, second);
  await expect(itemRow(page, milk)).toBeVisible();
  await selectBucket(page, first);
  await expect(itemRow(page, cat)).toBeVisible();

  await page.evaluate(() => {
    const w = window as unknown as { glitches: string[] };
    w.glitches = [];
    const check = () => {
      const view = document.querySelector("div.flex-1.overflow-y-auto > div");
      if (!view) return;
      if (view.querySelectorAll('[role="checkbox"]').length === 0) w.glitches.push("blank");
      if (getComputedStyle(view).opacity !== "1") w.glitches.push("fade");
    };
    new MutationObserver(check).observe(document.body, { subtree: true, childList: true });
  });
  await bucketTab(page, second).click();
  await expect(itemRow(page, milk)).toBeVisible();
  await bucketTab(page, first).click();
  await expect(itemRow(page, cat)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { glitches: string[] }).glitches)).toEqual(
    []
  );

  await option(field(await openTweaks(page), "reduce motion"), "off").click();
  await expectAfterReload(page, null);
});

async function watchAnimations(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { moving: Set<string> };
    w.moving = new Set();
    const check = () => {
      for (const animation of document.getAnimations()) {
        const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (duration > 1)
          w.moving.add(`${duration}ms ${target?.className.toString().slice(0, 40)}`);
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

async function animated(page: Page) {
  return page.evaluate(() => [...(window as unknown as { moving: Set<string> }).moving]);
}

test("with reduce motion drawers and dialogs open and close without animating", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Drawers"));
  await option(field(await openTweaks(page), "reduce motion"), "on").click();
  await expectAfterReload(page, "reduce");
  await watchAnimations(page);

  const drawers = [
    page.getByRole("button", { name: "bucket settings", exact: true }),
    page.getByRole("button", { name: "add with details", exact: true }),
    page.getByRole("button", { name: /new bucket|add bucket/i }).first(),
  ];
  for (const opener of drawers) {
    await opener.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const capy = page.getByRole("button", { name: "chat with capy" });
  await capy.click();
  await expect(capy).toHaveAttribute("aria-expanded", "true");
  await capy.click();
  await expect(capy).toHaveAttribute("aria-expanded", "false");
  await openTweaks(page);
  await page.keyboard.press("Escape");
  expect(await animated(page)).toEqual([]);

  await option(field(await openTweaks(page), "reduce motion"), "off").click();
  await expectAfterReload(page, null);
});
