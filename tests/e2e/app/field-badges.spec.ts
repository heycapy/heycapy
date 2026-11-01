import { test, expect, type Page } from "@playwright/test";
import Database from "better-sqlite3";
import { authState, specUserEmail } from "../helpers/auth";
import { E2E_DATABASE_FILE } from "../helpers/env";
import { selectBucket, uniqueName } from "../helpers/buckets";

test.use({ storageState: authState("field-badges"), deviceScaleFactor: 2 });

// Empty device pixels between the badge's border and its text, above and below, from a 2x screenshot
async function gapsAroundText(png: Buffer, page: Page) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const at = (x: number, y: number) =>
      data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3);
    // the sides stay clear of the border; a row counts as border when nearly all of it is drawn
    const side = 4;
    const bg = at(side, Math.floor(img.height / 2));
    const width = img.width - 2 * side;
    const drawn = (y: number) => {
      let count = 0;
      for (let x = side; x < img.width - side; x++) {
        const p = at(x, y);
        if (Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 90) count++;
      }
      return count;
    };
    const rows = Array.from({ length: img.height }, (_, y) => drawn(y));
    const isBorder = (n: number) => n >= width * 0.8;
    const half = Math.floor(img.height / 2);
    const topBorder = rows.slice(0, half).findLastIndex(isBorder);
    const bottomBorder = half + rows.slice(half).findIndex(isBorder);
    const text = rows.map((n, y) => y > topBorder && y < bottomBorder && n > 0);
    return {
      above: text.indexOf(true) - topBorder - 1,
      below: bottomBorder - text.lastIndexOf(true) - 1,
    };
  }, png.toString("base64"));
}

test("a field's text sits in the middle of its badge", async ({ page }) => {
  const name = uniqueName("rooms");
  const db = new Database(E2E_DATABASE_FILE);
  const { id: userId } = db
    .prepare("select id from users where email = ?")
    .get(specUserEmail("field-badges")) as { id: number };
  const fields = [{ key: "room", label: "Room", type: "text", showInRow: true }];
  const bucketId = Number(
    db
      .prepare("insert into buckets (user_id, name, field_schema) values (?, ?, ?)")
      .run(userId, name, JSON.stringify({ fields })).lastInsertRowid
  );
  db.prepare("insert into items (bucket_id, user_id, title, properties) values (?, ?, ?, ?)").run(
    bucketId,
    userId,
    "the meeting",
    JSON.stringify({ room: "B12" })
  );
  db.close();

  await page.goto("/");
  await selectBucket(page, name);
  const badge = page.getByText("Room: B12", { exact: true });
  await expect(badge).toBeVisible();

  // "Room: B12" has nothing below the baseline, so the space above and below the letters is comparable
  const { above, below } = await gapsAroundText(await badge.screenshot(), page);
  expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
});
