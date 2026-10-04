import { test, expect, type Page } from "@playwright/test";
import { CUSTOM_PROMPT_REQUIRED_ERROR } from "../../../src/constants";
import { authState } from "../helpers/auth";

test.use({ storageState: authState("personality") });
test.describe.configure({ mode: "serial" });

async function openPersonality(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "[ ··· ]", exact: true }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "personality", exact: true }).click();
}

const nameInput = (page: Page) =>
  page
    .locator("label", { hasText: /^name$/ })
    .locator("..")
    .locator("input");

test("the chat shows the name chosen in tweaks, not a fixed one", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat" }).click();
  await expect(page.getByPlaceholder("ask capy...")).toBeVisible();
  await page.getByRole("button", { name: "close chat" }).click();

  await openPersonality(page);
  await nameInput(page).fill("Zippy");
  await page.getByRole("button", { name: "[ save ]", exact: true }).click();
  await expect(page.getByText("tweaks", { exact: true })).toBeHidden();

  await page.getByRole("button", { name: "Open chat" }).click();
  await expect(page.getByPlaceholder("ask zippy...")).toBeVisible();
  await expect(page.getByText("zippy", { exact: true })).toBeVisible();
  await expect(page.getByText("Hi there! How can I help you today?")).toBeVisible();
  await expect(page.getByText(/heycapy/i)).toHaveCount(0);
});

test("the custom tone needs a prompt", async ({ page }) => {
  await openPersonality(page);
  await page.getByRole("button", { name: "custom", exact: true }).click();
  await page.getByRole("button", { name: "[ save ]", exact: true }).click();
  await expect(page.getByText(CUSTOM_PROMPT_REQUIRED_ERROR)).toBeVisible();

  await page.getByPlaceholder("Describe the tone and style...").fill("Talk like a pirate.");
  await page.getByRole("button", { name: "[ save ]", exact: true }).click();
  await expect(page.getByText("tweaks", { exact: true })).toBeHidden();

  await openPersonality(page);
  await expect(page.getByPlaceholder("Describe the tone and style...")).toHaveValue(
    "Talk like a pirate."
  );
});
