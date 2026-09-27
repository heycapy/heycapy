import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { NTFY_DEFAULT_URL } from "@/constants";

test.use({ storageState: authState("test-send") });

function ntfyInputs(ntfy: Locator): [Locator, Locator] {
  return [ntfy.getByPlaceholder(NTFY_DEFAULT_URL), ntfy.getByPlaceholder("heycapy-k3m9xp2qlr7a")];
}

async function openNtfySettings(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.getByRole("button", { name: "···" }).click();
  await page.getByRole("button", { name: "tweaks" }).click();
  await page.getByRole("button", { name: "notifications", exact: true }).click();
  return page
    .locator("div")
    .filter({ has: page.getByText("ntfy (push)", { exact: true }) })
    .last();
}

test("ntfy send test is disabled until a server url and topic are entered", async ({ page }) => {
  const ntfy = await openNtfySettings(page);
  const sendTest = ntfy.getByRole("button", { name: "[send test]" });
  const [url, topic] = ntfyInputs(ntfy);

  await url.fill("");
  await topic.fill("");
  await expect(sendTest).toBeDisabled();
  await url.fill("https://ntfy.example.com");
  await expect(sendTest).toBeDisabled();
  await topic.fill("capy-test");
  await expect(sendTest).toBeEnabled();
});

test("ntfy send test confirms the send", async ({ page }) => {
  const ntfy = await openNtfySettings(page);
  const [url, topic] = ntfyInputs(ntfy);
  await url.fill("https://ntfy.example.com");
  await topic.fill("capy-test");

  await ntfy.getByRole("button", { name: "[send test]" }).click();
  await expect(ntfy.getByRole("status")).toHaveText("sent ✓ — check that it arrived");
});

test("ntfy send test reports an invalid server url", async ({ page }) => {
  const ntfy = await openNtfySettings(page);
  const [url, topic] = ntfyInputs(ntfy);
  await url.fill("ftp://ntfy.example.com");
  await topic.fill("capy-test");

  await ntfy.getByRole("button", { name: "[send test]" }).click();
  await expect(ntfy.getByRole("status")).toHaveText(
    "server url must start with http:// or https://"
  );
});
