import { test, expect, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addBox, createAndSelectBucket, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("keybind-settings") });
test.describe.configure({ mode: "default" });

async function openTweaks(page: Page) {
  await page.goto("/");
  await page.keyboard.press("Control+;");
  await page.keyboard.press(",");
  return keybindingsTab(page);
}

async function keybindingsTab(page: Page) {
  const tweaks = page.getByRole("dialog", { name: /tweaks/ });
  await expect(tweaks).toBeVisible();
  await tweaks.getByRole("button", { name: "keybindings", exact: true }).click();
  return tweaks;
}

test("the prefix can be changed, survives a reload, and can be reset", async ({ page }) => {
  const tweaks = await openTweaks(page);
  await expect(tweaks.getByRole("button", { name: "reset prefix" })).toBeHidden();

  await tweaks.getByRole("button", { name: "change prefix" }).click();
  await expect(
    tweaks.getByText("hold Ctrl, Cmd or Alt and press a key. esc cancels")
  ).toBeVisible();
  await page.keyboard.press("Control+b");
  await expect(tweaks.getByRole("button", { name: "reset prefix" })).toBeVisible();
  await expect(tweaks.getByText("Ctrl+B", { exact: true })).toBeVisible();

  await page.reload();
  await page.keyboard.press("Control+;");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "keyboard shortcuts" })).toBeHidden();
  await page.keyboard.press("Control+b");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.keyboard.press("Control+b");
  await page.keyboard.press(",");
  await keybindingsTab(page);
  await tweaks.getByRole("button", { name: "reset prefix" }).click();
  await expect(tweaks.getByRole("button", { name: "reset prefix" })).toBeHidden();
  await expect(tweaks.getByText("Ctrl+;", { exact: true })).toBeVisible();
});

test("a prefix on Space is shown as Space, not left blank", async ({ page }) => {
  const tweaks = await openTweaks(page);
  await tweaks.getByRole("button", { name: "change prefix" }).click();
  await page.keyboard.press("Control+Space");
  await expect(tweaks.getByText("Ctrl+Space", { exact: true })).toBeVisible();
  await expect(tweaks.getByText("Ctrl+", { exact: true })).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(tweaks).toBeHidden();
  await page.keyboard.press("Control+Space");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "keyboard shortcuts" })).toContainText(
    "press Ctrl+Space then a key"
  );
  await page.keyboard.press("Escape");

  await page.keyboard.press("Control+Space");
  await page.keyboard.press(",");
  await keybindingsTab(page);
  await tweaks.getByRole("button", { name: "reset prefix" }).click();
  await expect(tweaks.getByText("Ctrl+;", { exact: true })).toBeVisible();
});

test("a prefix with no Ctrl, Cmd or Alt is refused", async ({ page }) => {
  const tweaks = await openTweaks(page);
  await tweaks.getByRole("button", { name: "change prefix" }).click();
  await page.keyboard.press("b");
  await expect(page.getByText("The prefix needs Ctrl, Cmd or Alt held with a key")).toBeVisible();
  await expect(
    tweaks.getByText("hold Ctrl, Cmd or Alt and press a key. esc cancels")
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tweaks.getByText("hold Ctrl, Cmd or Alt and press a key. esc cancels")).toBeHidden();
});

test("test your prefix says whether the page got the key", async ({ page }) => {
  const tweaks = await openTweaks(page);
  const test_ = tweaks.getByRole("button", { name: "test prefix" });

  await test_.click();
  await expect(tweaks.getByText("press Ctrl+; now. esc cancels")).toBeVisible();
  await page.keyboard.press("Control+;");
  await expect(tweaks.getByText("Ctrl+; reached the page, it will work")).toBeVisible();

  await test_.click();
  await expect(tweaks.getByText(/never reached the page/)).toBeVisible({ timeout: 8000 });
});

test("a prefix a browser uses gets a warning naming it", async ({ page }) => {
  const tweaks = await openTweaks(page);
  await tweaks.getByRole("button", { name: "change prefix" }).click();
  await page.keyboard.press("Control+k");
  await expect(tweaks.getByText(/Ctrl\+K searches from the address bar in Chrome/)).toBeVisible();
  await expect(tweaks.getByText(/Ctrl\+K focuses the search bar in Firefox/)).toBeVisible();

  await tweaks.getByRole("button", { name: "reset prefix" }).click();
  await expect(tweaks.getByText(/in Chrome/)).toBeHidden();
});

test("an action's key can be changed, a taken key is refused, and reset puts it back", async ({
  page,
}) => {
  await createAndSelectBucket(await openAndClose(page), uniqueName("Rebind"));
  const tweaks = await openTweaks(page);
  await tweaks.getByRole("button", { name: /change keys/ }).click();

  await tweaks.getByRole("button", { name: "change key for quick add" }).click();
  await page.keyboard.press("t");
  await expect(page.getByText('"t" is already today')).toBeVisible();
  await page.keyboard.press("q");
  await expect(tweaks.getByText("press a key...")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(tweaks).toBeHidden();

  await page.keyboard.press("Control+;");
  await page.keyboard.press("q");
  await expect(addBox(page)).toBeFocused();

  await page.keyboard.press("Control+;");
  await page.keyboard.press(",");
  await keybindingsTab(page);
  await tweaks.getByRole("button", { name: "reset keys" }).click();
  await expect(tweaks.getByRole("button", { name: "reset keys" })).toBeHidden();
  await tweaks.getByRole("button", { name: "keybindings", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(tweaks).toBeHidden();
  await page.keyboard.press("Control+;");
  await page.keyboard.press("a");
  await expect(addBox(page)).toBeFocused();
});

test("key hints on buttons shows the keys on buttons, and hides them again", async ({ page }) => {
  await createAndSelectBucket(await openAndClose(page), uniqueName("Hints"));
  const hint = (key: string) => page.locator("kbd", { hasText: new RegExp(`^${key}$`) });
  await expect(hint("t")).toHaveCount(0);

  const tweaks = await openTweaks(page);
  const hints = tweaks.getByRole("group", { name: "key hints on buttons" });
  await hints.getByRole("button", { name: "on" }).click();
  await expect(hints.getByRole("button", { name: "on" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(tweaks).toBeHidden();

  await page.reload();
  const tabs = page.getByRole("navigation", { name: "buckets" });
  for (const key of ["/", "t", "1", "s"])
    await expect(tabs.locator("kbd", { hasText: key }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "chat with capy" }).locator("kbd")).toHaveText("c");
  await expect(hint("a")).toBeVisible();
  await expect(hint("d")).toBeVisible();

  await page.keyboard.press("Control+;");
  await page.keyboard.press(",");
  const again = await keybindingsTab(page);
  await again
    .getByRole("group", { name: "key hints on buttons" })
    .getByRole("button", { name: "off" })
    .click();
  await expect(page.locator("main kbd")).toHaveCount(0);
});

async function openAndClose(page: Page) {
  await page.goto("/");
  return page;
}
