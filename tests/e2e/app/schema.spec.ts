import { test, expect, type Locator, type Page } from "@playwright/test";
import { authState } from "../helpers/auth";
import { addItem, createAndSelectBucket, itemRow, uniqueName } from "../helpers/buckets";
import {
  closeDialog,
  expectSelected,
  field,
  modal,
  openFromSettings,
  openSettings,
  option,
  saveSettings,
  switchTab,
} from "../helpers/settings";

test.use({ storageState: authState("schema") });
test.describe.configure({ mode: "default" });

async function openSchema(page: Page) {
  return openFromSettings(page, "advanced", "[ configure schema ]", /^schema \[/);
}

function fieldRows(schema: Locator): Locator {
  return schema.locator("[data-field-idx]");
}

async function addField(schema: Locator, name: string): Promise<Locator> {
  await schema.getByRole("button", { name: "add field" }).click();
  const row = fieldRows(schema).last();
  await row.getByPlaceholder("field name").fill(name);
  return row;
}

async function saveSchema(schema: Locator): Promise<void> {
  await schema.getByRole("button", { name: "[ save schema ]", exact: true }).click();
  await expect(schema).not.toBeVisible();
}

function itemDialog(page: Page): Locator {
  return modal(page, /^(new|edit) item$/);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await createAndSelectBucket(page, uniqueName("Schema Test"));
});

test("starts with no fields", async ({ page }) => {
  const { dialog: schema } = await openSchema(page);
  await expect(schema.getByText(/^no fields defined/)).toBeVisible();
  await expect(fieldRows(schema)).toHaveCount(0);
});

test("a saved field persists and shows up in the item dialog and list", async ({ page }) => {
  let { dialog: schema, settings } = await openSchema(page);
  await addField(schema, "Where");
  await saveSchema(schema);
  await closeDialog(settings);

  ({ dialog: schema, settings } = await openSchema(page));
  await expect(fieldRows(schema)).toHaveCount(1);
  await expect(fieldRows(schema).first().getByPlaceholder("field name")).toHaveValue("Where");
  await closeDialog(schema);
  await closeDialog(settings);

  const title = uniqueName("meeting");
  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = itemDialog(page);
  await dialog.locator("textarea").first().fill(title);
  await dialog.getByPlaceholder("Where").fill("office");
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await expect(itemRow(page, title)).toBeVisible();
  await expect(itemRow(page, title)).toContainText("office");
});

test("a field without a name blocks saving", async ({ page }) => {
  const { dialog: schema } = await openSchema(page);
  await schema.getByRole("button", { name: "add field" }).click();
  await schema.getByRole("button", { name: "[ save schema ]", exact: true }).click();

  await expect(schema.getByText("field name is required")).toBeVisible();
  await expect(schema).toBeVisible();

  await fieldRows(schema).first().getByPlaceholder("field name").fill("Amount");
  await expect(schema.getByText("field name is required")).not.toBeVisible();
});

test("removing a field drops it from the schema", async ({ page }) => {
  let { dialog: schema, settings } = await openSchema(page);
  await addField(schema, "Keep");
  await addField(schema, "Drop");
  await fieldRows(schema).last().getByRole("button", { name: "remove field" }).click();
  await expect(fieldRows(schema)).toHaveCount(1);
  await saveSchema(schema);
  await closeDialog(settings);

  ({ dialog: schema, settings } = await openSchema(page));
  await expect(fieldRows(schema)).toHaveCount(1);
  await expect(fieldRows(schema).first().getByPlaceholder("field name")).toHaveValue("Keep");
});

test("fields can be reordered with up and down", async ({ page }) => {
  let { dialog: schema, settings } = await openSchema(page);
  await addField(schema, "First");
  await addField(schema, "Second");

  const firstRow = fieldRows(schema).first();
  await expect(firstRow.getByRole("button", { name: "[ up ]", exact: true })).toBeDisabled();
  await firstRow.getByRole("button", { name: "[ down ]", exact: true }).click();
  await expect(fieldRows(schema).first().getByPlaceholder("field name")).toHaveValue("Second");
  await saveSchema(schema);
  await closeDialog(settings);

  ({ dialog: schema, settings } = await openSchema(page));
  await expect(fieldRows(schema).first().getByPlaceholder("field name")).toHaveValue("Second");
  await expect(fieldRows(schema).last().getByPlaceholder("field name")).toHaveValue("First");
});

test("a required field must be filled before adding an item", async ({ page }) => {
  const { dialog: schema, settings } = await openSchema(page);
  const row = await addField(schema, "Amount");
  await option(row, "required").click();
  await expectSelected(option(row, "required"));
  await saveSchema(schema);
  await closeDialog(settings);

  await page.getByRole("button", { name: "[ add + ]", exact: true }).click();
  const dialog = itemDialog(page);
  await dialog.locator("textarea").first().fill(uniqueName("missing amount"));
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(dialog.getByText("Amount is required")).toBeVisible();
  await expect(dialog).toBeVisible();

  await dialog.getByPlaceholder("Amount").fill("12");
  await dialog.getByRole("button", { name: "[ add ]", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("saving the schema keeps notification triggers set in settings", async ({ page }) => {
  const settingsDialog = await openSettings(page);
  await switchTab(settingsDialog, "notifications");
  await option(field(settingsDialog, "notify on arrival"), "on").click();
  await option(field(settingsDialog, "notify when overdue"), "on").click();
  await option(field(settingsDialog, "notify when overdue"), "4 hours").click();
  await saveSettings(settingsDialog);

  const { dialog: schema, settings } = await openSchema(page);
  await addField(schema, "Note");
  await saveSchema(schema);
  await closeDialog(settings);

  const reopened = await openSettings(page);
  await switchTab(reopened, "notifications");
  await expectSelected(option(field(reopened, "notify on arrival"), "on"));
  await expectSelected(option(field(reopened, "notify when overdue"), "on"));
  await expectSelected(option(field(reopened, "notify when overdue"), "4 hours"));
});

test("new fields can be added to a bucket that already has items", async ({ page }) => {
  const title = uniqueName("existing item");
  await addItem(page, title);

  const { dialog: schema, settings } = await openSchema(page);
  await addField(schema, "Priority");
  await saveSchema(schema);
  await closeDialog(settings);

  await itemRow(page, title).click();
  await expect(itemDialog(page).getByPlaceholder("Priority")).toBeVisible();
});
