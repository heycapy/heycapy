import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import { E2E_DATABASE_FILE } from "../helpers/env";
import {
  addBox,
  createAndSelectBucket,
  newItemForm,
  openBucketOnPhone,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("keybind-settings") });
test.describe.configure({ mode: "default" });

function setAccount(look: string, keybinds: string) {
  const db = new Database(E2E_DATABASE_FILE);
  db.prepare(
    "update user_settings set look = ?, keybinds = ? where user_id = (select id from users where email = ?)"
  ).run(look, keybinds, specUserEmail("keybind-settings"));
  db.close();
}

function tweaksDialog(page: Page) {
  return page.getByRole("dialog", { name: /tweaks/ });
}

async function keybindingsTab(page: Page) {
  const tweaks = tweaksDialog(page);
  await expect(tweaks).toBeVisible();
  await tweaks.getByRole("button", { name: "keybindings", exact: true }).click();
  return tweaks;
}

async function openTweaks(page: Page, prefix = "Control+;") {
  await page.goto("/");
  await page.keyboard.press(prefix);
  await page.keyboard.press(",");
  return keybindingsTab(page);
}

async function startPrefix(page: Page) {
  const tweaks = await openTweaks(page);
  await tweaks.getByRole("button", { name: "change prefix" }).click();
  await expect(tweaks.getByText("or press your own")).toBeVisible();
  return tweaks;
}

async function resetPrefix(page: Page, prefix: string) {
  await page.keyboard.press(prefix);
  await page.keyboard.press(",");
  const tweaks = await keybindingsTab(page);
  await tweaks.getByRole("button", { name: "use Ctrl+; again" }).click();
  await expect(tweaks.getByRole("button", { name: "use Ctrl+; again" })).toBeHidden();
}

test("a suggested prefix is picked, saved, kept after a reload and reset", async ({ page }) => {
  const tweaks = await startPrefix(page);
  const save = tweaks.getByRole("button", { name: "save prefix" });
  await expect(save).toBeDisabled();

  await tweaks.getByRole("button", { name: "Ctrl+'", exact: true }).click();
  await expect(
    tweaks.getByText("Ctrl+' has no known clash. Save it, or press something else.")
  ).toBeVisible();
  await save.click();
  await expect(tweaks.getByText("Saved. Ctrl+' is your prefix now.")).toBeVisible();
  await expect(tweaks.getByText("Ctrl+'", { exact: true })).toBeVisible();

  await page.reload();
  await page.keyboard.press("Control+;");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "keyboard shortcuts" })).toBeHidden();
  await page.keyboard.press("Control+'");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");

  await resetPrefix(page, "Control+'");
  await expect(tweaksDialog(page).getByText("Ctrl+;", { exact: true })).toBeVisible();
});

test("your own prefix shows live while you hold keys, and saves", async ({ page }) => {
  const tweaks = await startPrefix(page);
  const box = tweaks.getByRole("group", { name: "new prefix" });

  await page.keyboard.down("Control");
  await expect(box.getByText("Ctrl+...")).toBeVisible();
  await page.keyboard.press("b");
  await page.keyboard.up("Control");
  await expect(box.getByText("Ctrl+B", { exact: true })).toBeVisible();
  await expect(box.getByText("Ctrl+B works. Save it, or press something else.")).toBeVisible();

  await tweaks.getByRole("button", { name: "save prefix" }).click();
  await expect(tweaks.getByText("Saved. Ctrl+B is your prefix now.")).toBeVisible();
  await resetPrefix(page, "Control+b");
});

test("a prefix without Ctrl, Cmd or Alt is refused and Escape cancels", async ({ page }) => {
  const tweaks = await startPrefix(page);
  await page.keyboard.press("b");
  await expect(tweaks.getByText("Hold Ctrl, Cmd or Alt first, then press the key.")).toBeVisible();
  await page.keyboard.press("Control+Enter");
  await expect(tweaks.getByText("Use a letter, number or symbol key.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(tweaks.getByText("or press your own")).toBeHidden();
  await expect(tweaks.getByRole("button", { name: "change prefix" })).toBeFocused();
  await expect(tweaks.getByText("Ctrl+;", { exact: true })).toBeVisible();
});

test("a prefix a browser uses names who uses it, and can be checked", async ({ page }) => {
  const tweaks = await startPrefix(page);
  await page.keyboard.press("Control+k");
  await expect(
    tweaks.getByText(
      /Chrome uses Ctrl\+K to search from the address bar, so heycapy may not get it\./
    )
  ).toBeVisible();
  await expect(tweaks.getByText(/Firefox uses Ctrl\+K to focus the search bar/)).toBeVisible();
  await tweaks.getByRole("button", { name: "save prefix" }).click();

  await tweaks.getByRole("button", { name: "check it" }).click();
  await expect(tweaks.getByText("Press Ctrl+K now. Esc to cancel.")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(tweaks.getByText("Ctrl+K works. Your browser let it through.")).toBeVisible();

  await tweaks.getByRole("button", { name: "check it" }).click();
  await expect(tweaks.getByText(/Ctrl\+K didn't get through/)).toBeVisible({ timeout: 8000 });

  await resetPrefix(page, "Control+k");
});

test("a prefix on Space is shown as Space, not left blank", async ({ page }) => {
  const tweaks = await startPrefix(page);
  await page.keyboard.press("Control+Space");
  await expect(tweaks.getByText("Ctrl+Space", { exact: true })).toBeVisible();
  await tweaks.getByRole("button", { name: "save prefix" }).click();
  await expect(tweaks.getByText("Saved. Ctrl+Space is your prefix now.")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(tweaksDialog(page)).toBeHidden();
  await page.keyboard.press("Control+Space");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "keyboard shortcuts" })).toContainText(
    "Press Ctrl+Space then a key"
  );
  await page.keyboard.press("Escape");
  await resetPrefix(page, "Control+Space");
});

test("the recorder works from the keyboard alone", async ({ page }) => {
  const tweaks = await startPrefix(page);
  const first = tweaks.getByRole("group", { name: "new prefix" }).getByRole("button").first();
  await expect(first).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  const save = tweaks.getByRole("button", { name: "save prefix" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(tweaks.getByText(/^Saved\. .* is your prefix now\.$/)).toBeVisible();
  await expect(tweaks.getByRole("button", { name: "change prefix" })).toBeFocused();

  await tweaks.getByRole("button", { name: "use Ctrl+; again" }).click();
  await expect(tweaks.getByRole("button", { name: "use Ctrl+; again" })).toBeHidden();
});

test("the shortcuts are always listed, and a key can be recorded or cancelled", async ({
  page,
}) => {
  await createAndSelectBucket(await goHome(page), uniqueName("Rebind"));
  const tweaks = await openTweaks(page);
  await expect(tweaks.getByRole("button", { name: "change keys" })).toHaveCount(0);
  await expect(tweaks.getByText("bucket by tab order")).toBeVisible();
  await expect(tweaks.getByRole("button", { name: "reset all keys" })).toHaveAttribute(
    "aria-disabled",
    "true"
  );

  await tweaks.getByRole("button", { name: "record key for quick add" }).click();
  await expect(tweaks.getByText("Press the new key for quick add. Esc to cancel.")).toBeVisible();
  await tweaks.getByRole("button", { name: "cancel key for quick add" }).click();
  await expect(tweaks.getByText("Press the new key for quick add. Esc to cancel.")).toBeHidden();

  await tweaks.getByRole("button", { name: "record key for quick add" }).click();
  await page.keyboard.press("t");
  await expect(tweaks.getByText('"t" is already used for today. Pick another key.')).toBeVisible();
  await page.keyboard.press("3");
  await expect(tweaks.getByText('"3" is reserved for jumping to bucket 3.')).toBeVisible();
  await page.keyboard.press("q");
  await expect(tweaks.getByText("Quick add is now q.")).toBeVisible();
  await expect(tweaks.getByRole("button", { name: "reset all keys" })).toHaveAttribute(
    "aria-disabled",
    "false"
  );
  await expect(tweaks.getByRole("button", { name: "record key for quick add" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(tweaks).toBeHidden();
  await page.keyboard.press("Control+;");
  await page.keyboard.press("q");
  await expect(addBox(page)).toBeFocused();

  await page.keyboard.press("Control+;");
  await page.keyboard.press(",");
  await keybindingsTab(page);
  await tweaks.getByRole("button", { name: "reset all keys" }).click();
  await expect(tweaks.getByRole("button", { name: "reset all keys" })).toHaveAttribute(
    "aria-disabled",
    "true"
  );
  await tweaks.getByRole("button", { name: "keybindings", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(tweaks).toBeHidden();
  await page.keyboard.press("Control+;");
  await page.keyboard.press("a");
  await expect(addBox(page)).toBeFocused();
});

test("key hints on buttons shows the keys on buttons, and hides them again", async ({ page }) => {
  await createAndSelectBucket(await goHome(page), uniqueName("Hints"));
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
  for (const key of ["/", "t", "1", "s"]) {
    await expect(tabs.locator("kbd", { hasText: key }).first()).toBeVisible();
  }
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

test.describe("on a touchscreen without a mouse or trackpad", () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 393, height: 851 } });

  test("no key hints, and no keybindings tab", async ({ page }) => {
    await page.goto("/");
    await openBucketOnPhone(page, uniqueName("Touch"));
    setAccount("original", '{"hints":true}');
    try {
      await page.reload();
      const tabs = page.getByRole("navigation", { name: "buckets" });
      await expect(tabs.locator("kbd")).not.toHaveCount(0);
      for (const hint of await tabs.locator("kbd").all()) await expect(hint).toBeHidden();

      await page.getByRole("button", { name: "your menu", exact: true }).tap();
      await page.getByRole("button", { name: "tweaks", exact: true }).tap();
      const tweaks = tweaksDialog(page);
      await expect(tweaks.getByRole("button", { name: "appearance", exact: true })).toBeVisible();
      await expect(tweaks.getByRole("button", { name: "keybindings", exact: true })).toBeHidden();
    } finally {
      setAccount("original", "{}");
    }
  });
});

test("capy is a plain button with its key in the modern look too", async ({ page }) => {
  setAccount("modern", '{"hints":true}');
  try {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-look", "modern");
    const capy = page.getByRole("button", { name: "chat with capy" });
    await expect(capy).toContainText("capy");
    await expect(capy.locator("svg")).toHaveCount(0);
    await expect(capy.locator("kbd")).toHaveText("c");
  } finally {
    setAccount("original", "{}");
  }
});

test("the small headings in the prefix recorder are lowercase", async ({ page }) => {
  const tweaks = await startPrefix(page);
  for (const text of ["suggested, no known clash", "or press your own"]) {
    const heading = tweaks.getByText(text, { exact: true });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveCSS("text-transform", "none");
  }
});

test("the keys that add or save an item show on the add buttons when hints are on", async ({
  page,
}) => {
  await createAndSelectBucket(await goHome(page), uniqueName("Submit"));
  setAccount("original", '{"hints":true}');
  try {
    await page.reload();
    await page.keyboard.press("Control+;");
    await page.keyboard.press("a");
    await expect(addBox(page)).toBeFocused();
    await expect(page.getByRole("button", { name: "add item" }).locator("xpath=..")).toHaveCount(0);
    await addBox(page).fill("buy eggs");
    await expect(page.getByRole("button", { name: "add item" })).toBeVisible();
    await expect(page.locator("kbd", { hasText: /^Enter$/ })).toBeVisible();

    await page.keyboard.press("Control+;");
    await page.keyboard.press("d");
    await expect(newItemForm(page)).toBeVisible();
    await expect(newItemForm(page).locator("kbd", { hasText: /^Ctrl\+Enter$/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(newItemForm(page)).toBeHidden();

    setAccount("original", "{}");
    await page.reload();
    await addBox(page).fill("buy milk");
    await expect(page.locator("kbd", { hasText: /Enter$/ })).toHaveCount(0);
  } finally {
    setAccount("original", "{}");
  }
});

async function goHome(page: Page) {
  await page.goto("/");
  return page;
}
