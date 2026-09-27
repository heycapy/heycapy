import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import {
  closeDialog,
  expectSelected,
  field,
  modal,
  nameInput,
  openSettings,
  option,
  saveSettings,
  switchTab,
} from "../helpers/settings";
import {
  activeBucketTitle,
  addItem,
  bucketTab,
  createAndSelectBucket,
  createBucket,
  itemRow,
  selectBucket,
  uniqueName,
} from "../helpers/buckets";

test.use({ storageState: authState("settings") });
test.describe.configure({ mode: "default" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("settings modal", () => {
  let bucketName: string;

  test.beforeEach(async ({ page }) => {
    bucketName = uniqueName("Modal Test");
    await createAndSelectBucket(page, bucketName);
  });

  test("opens on the items tab with the bucket name in the header", async ({ page }) => {
    const dialog = await openSettings(page);
    await expect(dialog.getByText(`bucket settings [${bucketName}]`)).toBeVisible();
    await expect(nameInput(dialog)).toHaveValue(bucketName);
    await expect(field(dialog, "sort by")).toBeVisible();
    await expect(field(dialog, "show completed")).toBeVisible();
    await expect(field(dialog, "read only")).toBeVisible();
    await expect(field(dialog, "default deadline offset")).toBeVisible();
  });

  test("X button closes the modal", async ({ page }) => {
    const dialog = await openSettings(page);
    await closeDialog(dialog);
  });

  test("backdrop click closes the modal", async ({ page }) => {
    const dialog = await openSettings(page);
    await page.mouse.click(10, 10);
    await expect(dialog).not.toBeVisible();
  });

  test("closing without saving discards changes", async ({ page }) => {
    let dialog = await openSettings(page);
    await nameInput(dialog).fill("unsaved name");
    await option(field(dialog, "sort by"), "manual").click();
    await option(field(dialog, "read only"), "on").click();
    await closeDialog(dialog);

    await expect(activeBucketTitle(page)).toHaveText(bucketName);
    dialog = await openSettings(page);
    await expect(nameInput(dialog)).toHaveValue(bucketName);
    await expectSelected(option(field(dialog, "sort by"), "created"));
    await expectSelected(option(field(dialog, "read only"), "off"));
    await expect(field(dialog, "allow drag")).not.toBeVisible();
  });

  test("tabs switch between items, notifications and advanced", async ({ page }) => {
    const dialog = await openSettings(page);

    await switchTab(dialog, "notifications");
    await expect(field(dialog, "channels")).toBeVisible();
    await expect(field(dialog, "sort by")).not.toBeVisible();

    await switchTab(dialog, "advanced");
    await expect(dialog.getByText("danger zone", { exact: true })).toBeVisible();
    await expect(field(dialog, "channels")).not.toBeVisible();

    await switchTab(dialog, "items");
    await expect(field(dialog, "sort by")).toBeVisible();
    await expect(dialog.getByText("danger zone", { exact: true })).not.toBeVisible();
  });

  test("save button is shown on items and notifications, hidden on advanced", async ({ page }) => {
    const dialog = await openSettings(page);
    const save = option(dialog, "[ save ]");
    await expect(save).toBeVisible();

    await switchTab(dialog, "notifications");
    await expect(save).toBeVisible();

    await switchTab(dialog, "advanced");
    await expect(save).not.toBeVisible();
  });

  test("reopening resets to the items tab", async ({ page }) => {
    let dialog = await openSettings(page);
    await switchTab(dialog, "advanced");
    await closeDialog(dialog);

    dialog = await openSettings(page);
    await expect(field(dialog, "sort by")).toBeVisible();
    await expect(dialog.getByText("danger zone", { exact: true })).not.toBeVisible();
  });
});

test.describe("rename bucket", () => {
  let bucketName: string;

  test.beforeEach(async ({ page }) => {
    bucketName = uniqueName("Rename Test");
    await createAndSelectBucket(page, bucketName);
  });

  test("renames the bucket in the tab list and header", async ({ page }) => {
    const newName = uniqueName("Renamed");
    const dialog = await openSettings(page);
    await nameInput(dialog).fill(newName);
    await saveSettings(dialog);

    await expect(bucketTab(page, newName)).toBeVisible();
    await expect(bucketTab(page, bucketName)).not.toBeVisible();
    await expect(activeBucketTitle(page)).toHaveText(newName);
  });

  test("rename survives a reload", async ({ page }) => {
    const newName = uniqueName("Renamed");
    const dialog = await openSettings(page);
    await nameInput(dialog).fill(newName);
    await saveSettings(dialog);

    await page.reload();
    await expect(bucketTab(page, newName)).toBeVisible();
    await expect(bucketTab(page, bucketName)).not.toBeVisible();
  });

  test("trims surrounding whitespace from the new name", async ({ page }) => {
    const newName = uniqueName("Trimmed");
    const dialog = await openSettings(page);
    await nameInput(dialog).fill(`   ${newName}   `);
    await saveSettings(dialog);
    await expect(activeBucketTitle(page)).toHaveText(newName);
  });

  test("save is disabled for an empty or whitespace-only name", async ({ page }) => {
    const dialog = await openSettings(page);
    const save = option(dialog, "[ save ]");

    await nameInput(dialog).fill("");
    await expect(save).toBeDisabled();

    await nameInput(dialog).fill("   ");
    await expect(save).toBeDisabled();

    await nameInput(dialog).fill("x");
    await expect(save).toBeEnabled();
  });

  test("shows a live character counter", async ({ page }) => {
    const dialog = await openSettings(page);
    await nameInput(dialog).fill("abcde");
    await expect(dialog.getByText("5/100", { exact: true })).toBeVisible();

    await nameInput(dialog).fill("");
    await expect(dialog.getByText(/^\d+\/100$/)).not.toBeVisible();
  });

  test("rejects renaming to a name that already exists", async ({ page }) => {
    const otherName = uniqueName("Other Bucket");
    await createBucket(page, otherName);
    await selectBucket(page, bucketName);

    const dialog = await openSettings(page);
    await nameInput(dialog).fill(otherName);
    await dialog.getByRole("button", { name: "[ save ]", exact: true }).click();

    await expect(dialog.getByText("A bucket with this name already exists.")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("rejects renaming to an existing name in a different case", async ({ page }) => {
    const otherName = uniqueName("Other Bucket");
    await createBucket(page, otherName);
    await selectBucket(page, bucketName);

    const dialog = await openSettings(page);
    await nameInput(dialog).fill(otherName.toLowerCase());
    await dialog.getByRole("button", { name: "[ save ]", exact: true }).click();
    await expect(dialog.getByText("A bucket with this name already exists.")).toBeVisible();
  });

  test("changing only the letter case of its own name is allowed", async ({ page }) => {
    const dialog = await openSettings(page);
    await nameInput(dialog).fill(bucketName.toUpperCase());
    await saveSettings(dialog);
    await expect(activeBucketTitle(page)).toHaveText(bucketName.toUpperCase());
  });
});

test.describe("items settings", () => {
  test.beforeEach(async ({ page }) => {
    await createAndSelectBucket(page, uniqueName("Items Settings"));
  });

  test("defaults: sort by created, show completed on, read only off", async ({ page }) => {
    const dialog = await openSettings(page);
    await expectSelected(option(field(dialog, "sort by"), "created"));
    await expectSelected(option(field(dialog, "show completed"), "on"));
    await expectSelected(option(field(dialog, "read only"), "off"));
    await expect(dialog.getByPlaceholder("e.g. 7 days, 2 weeks")).toHaveValue("");
  });

  test("sort by is single-select", async ({ page }) => {
    const dialog = await openSettings(page);
    const sortBy = field(dialog, "sort by");

    await option(sortBy, "deadline").click();
    await expectSelected(option(sortBy, "deadline"));
    await expectSelected(option(sortBy, "created"), false);
    await expectSelected(option(sortBy, "manual"), false);
  });

  test("allow drag only appears for manual sort", async ({ page }) => {
    const dialog = await openSettings(page);
    const sortBy = field(dialog, "sort by");
    await expect(field(dialog, "allow drag")).not.toBeVisible();

    await option(sortBy, "manual").click();
    await expect(field(dialog, "allow drag")).toBeVisible();

    await option(sortBy, "deadline").click();
    await expect(field(dialog, "allow drag")).not.toBeVisible();

    await option(sortBy, "created").click();
    await expect(field(dialog, "allow drag")).not.toBeVisible();
  });

  test("manual sort with drag enabled persists", async ({ page }) => {
    let dialog = await openSettings(page);
    await option(field(dialog, "sort by"), "manual").click();
    await option(field(dialog, "allow drag"), "on").click();
    await saveSettings(dialog);

    await page.reload();
    dialog = await openSettings(page);
    await expectSelected(option(field(dialog, "sort by"), "manual"));
    await expectSelected(option(field(dialog, "allow drag"), "on"));
  });

  test("show completed off hides completed items from the list", async ({ page }) => {
    const active = uniqueName("still to do");
    const done = uniqueName("already done");
    await addItem(page, active);
    await addItem(page, done, { status: "completed" });

    let dialog = await openSettings(page);
    await option(field(dialog, "show completed"), "off").click();
    await saveSettings(dialog);

    await expect(itemRow(page, done)).not.toBeVisible();
    await expect(itemRow(page, active)).toBeVisible();

    dialog = await openSettings(page);
    await expectSelected(option(field(dialog, "show completed"), "off"));
    await option(field(dialog, "show completed"), "on").click();
    await saveSettings(dialog);

    await expect(itemRow(page, done)).toBeVisible();
    await expect(itemRow(page, active)).toBeVisible();
  });

  test("read only hides the add button and blocks editing", async ({ page }) => {
    const title = uniqueName("locked item");
    await addItem(page, title);

    let dialog = await openSettings(page);
    await option(field(dialog, "read only"), "on").click();
    await saveSettings(dialog);

    await expect(option(page.locator("main"), "[ add + ]")).not.toBeVisible();
    await itemRow(page, title).click();
    await expect(page.getByText("edit item", { exact: true })).not.toBeVisible();

    dialog = await openSettings(page);
    await expectSelected(option(field(dialog, "read only"), "on"));
    await option(field(dialog, "read only"), "off").click();
    await saveSettings(dialog);

    await expect(option(page.locator("main"), "[ add + ]")).toBeVisible();
  });

  test("default deadline offset previews valid input and flags invalid input", async ({ page }) => {
    const dialog = await openSettings(page);
    const offset = field(dialog, "default deadline offset");
    const input = offset.getByPlaceholder("e.g. 7 days, 2 weeks");

    await input.fill("nonsense");
    await expect(offset.getByText("unrecognized format", { exact: true })).toBeVisible();

    await input.fill("3 days");
    await expect(offset.getByText("unrecognized format", { exact: true })).not.toBeVisible();
    await expect(offset.getByText(/→/)).toBeVisible();
  });

  test("default deadline offset persists and is normalised", async ({ page }) => {
    let dialog = await openSettings(page);
    await dialog.getByPlaceholder("e.g. 7 days, 2 weeks").fill("14 days");
    await saveSettings(dialog);

    dialog = await openSettings(page);
    await expect(dialog.getByPlaceholder("e.g. 7 days, 2 weeks")).toHaveValue("2 weeks");

    await dialog.getByPlaceholder("e.g. 7 days, 2 weeks").fill("");
    await saveSettings(dialog);

    dialog = await openSettings(page);
    await expect(dialog.getByPlaceholder("e.g. 7 days, 2 weeks")).toHaveValue("");
  });
});

test.describe("notifications settings", () => {
  let dialog: Locator;

  test.beforeEach(async ({ page }) => {
    await createAndSelectBucket(page, uniqueName("Notifs Test"));
    dialog = await openSettings(page);
    await switchTab(dialog, "notifications");
    await expect(field(dialog, "channels")).toBeVisible();
  });

  async function reopenOnNotifications(page: Page): Promise<Locator> {
    const reopened = await openSettings(page);
    await switchTab(reopened, "notifications");
    return reopened;
  }

  test("defaults: the user's working channel, repeat once, triggers off", async () => {
    const channels = field(dialog, "channels");
    await expectSelected(option(channels, "email"));
    await expectSelected(option(channels, "ntfy"), false);
    await expectSelected(option(channels, "telegram"), false);
    await expectSelected(option(field(dialog, "deadline repeat"), "once"));
    await expectSelected(option(field(dialog, "notify on arrival"), "off"));
    await expectSelected(option(field(dialog, "notify when overdue"), "off"));
  });

  test("channels are multi-select and toggle off on second click", async () => {
    const channels = field(dialog, "channels");

    await option(channels, "ntfy").click();
    await expectSelected(option(channels, "ntfy"));
    await expectSelected(option(channels, "email"));
    await expectSelected(option(channels, "telegram"), false);

    await option(channels, "email").click();
    await expectSelected(option(channels, "email"), false);
    await expectSelected(option(channels, "ntfy"));
  });

  test("deadline repeat is single-select", async () => {
    const repeat = field(dialog, "deadline repeat");

    await option(repeat, "daily").click();
    await expectSelected(option(repeat, "daily"));
    await expectSelected(option(repeat, "once"), false);

    await option(repeat, "once").click();
    await expectSelected(option(repeat, "once"));
    await expectSelected(option(repeat, "daily"), false);
  });

  test("remind before deadline previews and flags input", async () => {
    const remind = field(dialog, "remind me before deadline");
    const input = remind.getByRole("textbox");

    await input.fill("nonsense");
    await expect(remind.getByText("unrecognized format", { exact: true })).toBeVisible();

    await input.fill("3 hours");
    await expect(remind.getByText("unrecognized format", { exact: true })).not.toBeVisible();
  });

  test("notify at accepts 12h and 24h formats and rejects invalid times", async () => {
    const notifyAt = field(dialog, "notify at");
    const input = notifyAt.getByRole("textbox");

    await input.fill("14:30");
    await input.blur();
    await expect(input).toHaveValue("2:30 pm");

    await input.fill("9 am");
    await input.blur();
    await expect(input).toHaveValue("9 am");

    await input.fill("25:00");
    await input.blur();
    await expect(notifyAt.getByText("unrecognized format", { exact: true })).toBeVisible();
  });

  test("notify when overdue reveals repeat frequencies only while on", async () => {
    const overdue = field(dialog, "notify when overdue");
    await expect(overdue.getByText(/^repeat every/)).not.toBeVisible();

    await option(overdue, "on").click();
    await expect(overdue.getByText(/^repeat every/)).toBeVisible();
    for (const freq of ["15 min", "30 min", "1 hour", "2 hours", "4 hours", "8 hours"]) {
      await expect(option(overdue, freq)).toBeVisible();
    }

    await option(overdue, "off").click();
    await expect(overdue.getByText(/^repeat every/)).not.toBeVisible();
  });

  test("overdue repeat frequency is single-select and deselects on second click", async () => {
    const overdue = field(dialog, "notify when overdue");
    await option(overdue, "on").click();

    await option(overdue, "1 hour").click();
    await expectSelected(option(overdue, "1 hour"));

    await option(overdue, "4 hours").click();
    await expectSelected(option(overdue, "4 hours"));
    await expectSelected(option(overdue, "1 hour"), false);

    await option(overdue, "4 hours").click();
    await expectSelected(option(overdue, "4 hours"), false);
  });

  test("all notification settings persist after save and reload", async ({ page }) => {
    await option(field(dialog, "channels"), "telegram").click();
    await field(dialog, "remind me before deadline").getByRole("textbox").fill("3 hours");
    const notifyAt = field(dialog, "notify at").getByRole("textbox");
    await notifyAt.fill("8:15 am");
    await notifyAt.blur();
    await option(field(dialog, "deadline repeat"), "daily").click();
    await option(field(dialog, "notify on arrival"), "on").click();
    await option(field(dialog, "notify when overdue"), "on").click();
    await option(field(dialog, "notify when overdue"), "2 hours").click();
    await saveSettings(dialog);

    await page.reload();
    const reopened = await reopenOnNotifications(page);
    await expectSelected(option(field(reopened, "channels"), "email"));
    await expectSelected(option(field(reopened, "channels"), "telegram"));
    await expectSelected(option(field(reopened, "channels"), "ntfy"), false);
    await expect(field(reopened, "remind me before deadline").getByRole("textbox")).toHaveValue(
      "3 hours"
    );
    await expect(field(reopened, "notify at").getByRole("textbox")).toHaveValue("8:15 am");
    await expectSelected(option(field(reopened, "deadline repeat"), "daily"));
    await expectSelected(option(field(reopened, "notify on arrival"), "on"));
    await expectSelected(option(field(reopened, "notify when overdue"), "on"));
    await expectSelected(option(field(reopened, "notify when overdue"), "2 hours"));
  });

  test("turning overdue off clears the saved repeat frequency", async ({ page }) => {
    await option(field(dialog, "notify when overdue"), "on").click();
    await option(field(dialog, "notify when overdue"), "2 hours").click();
    await saveSettings(dialog);

    let reopened = await reopenOnNotifications(page);
    await option(field(reopened, "notify when overdue"), "off").click();
    await saveSettings(reopened);

    reopened = await reopenOnNotifications(page);
    await option(field(reopened, "notify when overdue"), "on").click();
    await expectSelected(option(field(reopened, "notify when overdue"), "2 hours"), false);
  });

  test("configure telegram opens its dialog on top of settings", async ({ page }) => {
    await option(dialog, "[ configure telegram ]").click();
    const telegram = modal(page, /^telegram config \[/);
    await expect(telegram).toBeVisible();

    await option(telegram, "[ x ]").click();
    await expect(telegram).not.toBeVisible();
    await expect(dialog).toBeVisible();
  });
});

test.describe("advanced settings", () => {
  let bucketName: string;
  let dialog: Locator;

  test.beforeEach(async ({ page }) => {
    bucketName = uniqueName("Advanced Test");
    await createAndSelectBucket(page, bucketName);
    dialog = await openSettings(page);
    await switchTab(dialog, "advanced");
  });

  test("configure schema opens its dialog on top of settings", async ({ page }) => {
    await option(dialog, "[ configure schema ]").click();
    const schema = modal(page, /^schema \[/);
    await expect(schema).toBeVisible();

    await option(schema, "[ x ]").click();
    await expect(schema).not.toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("configure webhook opens its dialog on top of settings", async ({ page }) => {
    await option(dialog, "[ configure webhook ]").click();
    const webhook = modal(page, /^webhook \[/);
    await expect(webhook).toBeVisible();

    await option(webhook, "[ x ]").click();
    await expect(webhook).not.toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("archive removes the bucket from the tab list", async ({ page }) => {
    await option(dialog, "[ archive ]").click();
    await expect(dialog).not.toBeVisible();
    await expect(bucketTab(page, bucketName)).not.toBeVisible();

    await page.reload();
    await expect(bucketTab(page, bucketName)).not.toBeVisible();
  });

  test("delete asks for confirmation, confirm removes the bucket", async ({ page }) => {
    await option(dialog, "[ delete ]").click();
    await expect(dialog.getByText("sure?", { exact: true })).toBeVisible();
    await expect(option(dialog, "[ delete ]")).not.toBeVisible();

    await option(dialog, "[ confirm ]").click();
    await expect(dialog).not.toBeVisible();
    await expect(bucketTab(page, bucketName)).not.toBeVisible();

    await page.reload();
    await expect(bucketTab(page, bucketName)).not.toBeVisible();
  });

  test("delete cancel restores the delete button and keeps the bucket", async ({ page }) => {
    await option(dialog, "[ delete ]").click();
    await option(dialog, "[ cancel ]").click();

    await expect(dialog.getByText("sure?", { exact: true })).not.toBeVisible();
    await expect(option(dialog, "[ confirm ]")).not.toBeVisible();
    await expect(option(dialog, "[ delete ]")).toBeVisible();

    await closeDialog(dialog);
    await expect(bucketTab(page, bucketName)).toBeVisible();
  });

  test("delete confirmation is reset when settings are reopened", async ({ page }) => {
    await option(dialog, "[ delete ]").click();
    await expect(dialog.getByText("sure?", { exact: true })).toBeVisible();
    await closeDialog(dialog);

    const reopened = await openSettings(page);
    await switchTab(reopened, "advanced");
    await expect(option(reopened, "[ delete ]")).toBeVisible();
    await expect(reopened.getByText("sure?", { exact: true })).not.toBeVisible();
  });
});
