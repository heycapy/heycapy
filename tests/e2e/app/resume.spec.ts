import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("resume") });

test("coming back to the app shows changes made while it was in the background", async ({
  page,
}) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Resume"));
  const webhook = await enableWebhook(page);

  await page.route("**/api/events", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("button", { name: "[ add + ]", exact: true })).toBeVisible();

  const title = uniqueName("added elsewhere");
  expect((await postItem(page.request, webhook, { title })).status()).toBe(201);
  await expect(itemRow(page, title)).toHaveCount(0);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(itemRow(page, title)).toBeVisible();
});
