import { test, expect } from "@playwright/test";
import { authState } from "../helpers/auth";

test.use({
  storageState: authState("voice"),
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

// the transcript stands in for the server so the page's own permissions are what's tested
test("the mic records while capy listens, then puts what it heard in the input", async ({
  page,
}) => {
  let release = () => {};
  const answered = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/transcribe", async (route) => {
    await answered;
    await route.fulfill({ json: { text: "add milk" } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open chat" }).click();
  await page.getByRole("button", { name: "Record voice" }).click();
  await expect(page.getByText(/^capy listening\.\.\. \d+:\d+$/)).toBeVisible();

  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("capy's jotting it down...")).toBeVisible();
  release();

  await expect(page.getByPlaceholder("ask capy...")).toHaveValue("add milk");
});

test("a quick tap on the mic never reaches the server and says to hold it longer", async ({
  page,
}) => {
  let uploads = 0;
  await page.route("**/api/transcribe", async (route) => {
    uploads++;
    await route.fulfill({ json: { text: "should not happen" } });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open chat" }).click();
  await page.getByRole("button", { name: "Record voice" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();

  await expect(page.getByText("didn't catch that")).toBeVisible();
  await expect(page.getByText("Hold the mic a bit longer while you talk.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Record voice" })).toBeVisible();
  expect(uploads).toBe(0);
  await expect(page.getByPlaceholder("ask capy...")).toHaveValue("");
});

test("the prefix then m starts and stops the mic while the chat is open", async ({ page }) => {
  await page.route("**/api/transcribe", (route) => route.fulfill({ json: { text: "add eggs" } }));

  await page.goto("/");
  await page.keyboard.press("Control+;");
  await page.keyboard.press("m");
  await expect(page.getByText(/^capy listening/)).toBeHidden();

  await page.getByRole("button", { name: "Open chat" }).click();
  await page.keyboard.press("Control+;");
  await page.keyboard.press("m");
  await expect(page.getByText(/^capy listening\.\.\. \d+:\d+$/)).toBeVisible();

  await page.waitForTimeout(1000);
  await page.keyboard.press("Control+;");
  await page.keyboard.press("m");
  await expect(page.getByPlaceholder("ask capy...")).toHaveValue("add eggs");
});

test("the old Ctrl+Shift+M and Ctrl+\\ shortcuts no longer do anything", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+\\");
  await expect(page.getByPlaceholder("ask capy...")).toBeHidden();

  await page.getByRole("button", { name: "Open chat" }).click();
  await page.keyboard.press("Control+Shift+M");
  await expect(page.getByText(/^capy listening/)).toBeHidden();
  await page.keyboard.press("Control+\\");
  await expect(page.getByPlaceholder("ask capy...")).toBeVisible();
});
