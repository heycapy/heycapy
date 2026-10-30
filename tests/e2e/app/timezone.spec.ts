import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import { createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import { modal } from "../helpers/settings";
import { enableWebhook, postItem } from "../helpers/webhook";

test.use({ storageState: authState("timezone"), timezoneId: "America/New_York" });

test("updating an item without changes keeps its date and time", async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Zones"));
  const webhook = await enableWebhook(page);
  const title = uniqueName("timed");
  const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(`${day}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")
    ?.value.replace("GMT", "");
  const deadline = new Date(`${day}T21:00:00${offset}`).toISOString();
  expect((await postItem(page.request, webhook, { title, deadline })).status()).toBe(201);
  await page.reload();

  const row = itemRow(page, title);
  await expect(row).toContainText("9pm");
  const before = await row.innerText();
  await row.click();
  const dialog = modal(page, /^edit item$/);
  await dialog.getByRole("button", { name: "[ update ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.reload();
  await expect.poll(() => itemRow(page, title).innerText()).toBe(before);
});

test("a timezone that doesn't exist is refused and the saved one stays", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  const timezone = page.getByPlaceholder("America/New_York");
  await expect(timezone).not.toHaveValue("");
  const saved = await timezone.inputValue();

  await timezone.fill("America/New_Yrok");
  await page.getByRole("button", { name: /^\[\s*save\s*\]$/ }).click();

  await expect(
    page.getByText('Unknown timezone "America/New_Yrok" — use one like Europe/London')
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await expect(timezone).toHaveValue(saved);
});
