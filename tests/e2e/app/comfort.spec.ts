import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItem,
  createAndSelectBucket,
  itemRow,
  itemRowContainer,
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
