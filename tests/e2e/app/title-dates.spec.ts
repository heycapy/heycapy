import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  addItemButton,
  createAndSelectBucket,
  detailChip,
  newItemForm,
  openDetail,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("title-dates") });

const WEDNESDAY = new Date(2026, 9, 7, 8, 0);

test("a date typed in the title fills the date and time, and the words leave the title on add", async ({
  page,
}) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Typed"));
  await addItemButton(page).click();
  const form = newItemForm(page);
  const title = uniqueName("pay rent");

  await form.locator("textarea").first().fill(`${title} by friday 9pm`);
  await expect(detailChip(form, "date")).toHaveAccessibleName("date: Oct 9");
  await expect(form.getByRole("button", { name: "time: 9 pm" })).toBeVisible();
  await expect(form.locator("textarea").first()).toHaveValue(`${title} by friday 9pm`);

  await form.getByRole("button", { name: "add", exact: true }).click();
  await expect(form).toBeHidden();
  const row = page.getByRole("button", { name: new RegExp(`^${title}`) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("9:00 pm");
  await expect(row).not.toContainText("friday");
});

test("deleting the typed words gives the date back, and a date picked by hand wins over typing", async ({
  page,
}) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Hand"));
  await addItemButton(page).click();
  const form = newItemForm(page);
  const title = form.locator("textarea").first();

  await title.fill("call mum friday");
  await expect(detailChip(form, "date")).toHaveAccessibleName("date: Oct 9");
  await title.fill("call mum");
  await expect(detailChip(form, "date")).toHaveAccessibleName("date");

  await openDetail(form, "date");
  await page.getByRole("button", { name: "20", exact: true }).click();
  await expect(detailChip(form, "date")).toHaveAccessibleName("date: Oct 20");
  await title.fill("call mum tomorrow");
  await expect(detailChip(form, "date")).toHaveAccessibleName("date: Oct 20");
  await form.getByRole("button", { name: "add", exact: true }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole("button", { name: /^call mum tomorrow/ })).toBeVisible();
});
