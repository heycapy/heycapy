import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("offline") });

const banner = (page: Page) => page.getByRole("status").filter({ hasText: "can't reach heycapy" });

test("going offline shows the notice and coming back removes it", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  await context.setOffline(true);
  await expect(banner(page)).toBeVisible();

  await context.setOffline(false);
  await expect(banner(page)).toHaveCount(0);
});

test("a list that can't load shows the notice, and a later load removes it", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("offline"));

  await page.route("**/*", (route) =>
    route.request().headers()["next-action"] ? route.abort() : route.continue()
  );
  await page.reload();
  await expect(banner(page)).toBeVisible();

  await page.unroute("**/*");
  await page.reload();
  await expect(page.locator("main h2")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});
