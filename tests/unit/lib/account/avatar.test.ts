import { describe, expect, it } from "vitest";
import {
  AVATAR_PATTERN,
  avatarCode,
  avatarFor,
  avatarRuns,
  blankCells,
  cellAt,
  cellsBetween,
  defaultAvatar,
  fill,
  paint,
  presetCells,
  toAvatar,
  toCells,
} from "@/lib/account/avatar";
import { AVATAR_PRESETS } from "@/lib/account/avatar-presets";
import { AVATAR_DEFAULT_COLOURS, AVATAR_PALETTE } from "@/lib/account/constants";

const RED = avatarCode(8);
const BLUE = avatarCode(13);

describe("avatar format", () => {
  it("gives every palette colour its own one-character code", () => {
    const codes = AVATAR_PALETTE.map((_, index) => avatarCode(index));
    expect(codes.join("")).toBe("0123456789abcdef");
  });

  it("accepts 256 palette codes or empty cells and nothing else", () => {
    expect(AVATAR_PATTERN.test(".".repeat(256))).toBe(true);
    expect(AVATAR_PATTERN.test("0f".repeat(128))).toBe(true);
    expect(AVATAR_PATTERN.test(".".repeat(255))).toBe(false);
    expect(AVATAR_PATTERN.test(".".repeat(257))).toBe(false);
    expect(AVATAR_PATTERN.test("g" + ".".repeat(255))).toBe(false);
    expect(AVATAR_PATTERN.test("<" + ".".repeat(255))).toBe(false);
  });

  it("saves an empty drawing as no avatar", () => {
    expect(toAvatar(blankCells())).toBeNull();
    const drawn = paint(blankCells(), [0], RED, false);
    expect(toAvatar(drawn)).toBe(RED + ".".repeat(255));
  });

  it("reads a broken stored value as a blank drawing", () => {
    expect(toCells("nope")).toEqual(blankCells());
    expect(toCells(null)).toEqual(blankCells());
  });
});

describe("painting", () => {
  it("paints the mirrored cell too in mirror mode", () => {
    const cells = paint(blankCells(), [cellAt(2, 5)], RED, true);
    expect(cells[cellAt(2, 5)]).toBe(RED);
    expect(cells[cellAt(13, 5)]).toBe(RED);
    expect(cells.filter((cell) => cell !== ".")).toHaveLength(2);
  });

  it("leaves the cells it was given untouched", () => {
    const before = blankCells();
    paint(before, [0], RED, false);
    expect(before).toEqual(blankCells());
  });

  it("joins a fast drag into a line with no gaps", () => {
    expect(cellsBetween(cellAt(0, 0), cellAt(3, 0))).toEqual([0, 1, 2, 3]);
    expect(cellsBetween(cellAt(0, 0), cellAt(3, 3))).toEqual([
      cellAt(0, 0),
      cellAt(1, 1),
      cellAt(2, 2),
      cellAt(3, 3),
    ]);
    expect(cellsBetween(cellAt(5, 5), cellAt(5, 5))).toEqual([cellAt(5, 5)]);
  });
});

describe("fill", () => {
  it("fills only the area the cell belongs to, stopping at other colours", () => {
    const wall = Array.from({ length: 16 }, (_, y) => cellAt(4, y));
    const cells = fill(paint(blankCells(), wall, RED, false), cellAt(0, 0), BLUE, false);
    expect(cells[cellAt(0, 0)]).toBe(BLUE);
    expect(cells[cellAt(3, 15)]).toBe(BLUE);
    expect(cells[cellAt(4, 0)]).toBe(RED);
    expect(cells[cellAt(5, 0)]).toBe(".");
  });

  it("does not leak across the left and right edges", () => {
    const wall = Array.from({ length: 16 }, (_, y) => cellAt(15, y));
    const cells = fill(paint(blankCells(), wall, RED, false), cellAt(15, 0), BLUE, false);
    expect(cells[cellAt(0, 1)]).toBe(".");
    expect(cells.filter((cell) => cell === BLUE)).toHaveLength(16);
  });

  it("fills the mirrored area too in mirror mode", () => {
    const wall = Array.from({ length: 16 }, (_, y) => cellAt(2, y));
    const cells = fill(paint(blankCells(), wall, RED, false), cellAt(0, 0), BLUE, true);
    expect(cells[cellAt(0, 0)]).toBe(BLUE);
    expect(cells[cellAt(15, 0)]).toBe(BLUE);
  });
});

describe("rendering", () => {
  it("draws one rect per run of a colour in a row and none for empty cells", () => {
    const cells = paint(blankCells(), [cellAt(1, 0), cellAt(2, 0), cellAt(3, 0)], RED, false);
    expect(avatarRuns(cells)).toEqual([{ x: 1, y: 0, width: 3, fill: "fill-avatar-8" }]);
    expect(avatarRuns(blankCells())).toEqual([]);
  });
});

describe("generated avatar", () => {
  const codesOf = (cells: readonly string[]) => new Set(cells.filter((cell) => cell !== "."));

  it("is the same picture every time for the same person", () => {
    expect(defaultAvatar(42)).toEqual(defaultAvatar(42));
  });

  it("gives different people different pictures", () => {
    const pictures = new Set(Array.from({ length: 50 }, (_, id) => defaultAvatar(id + 1).join("")));
    expect(pictures.size).toBe(50);
  });

  it("is mirrored, one bright colour, never empty, and keeps a margin", () => {
    for (let id = 1; id <= 200; id++) {
      const cells = defaultAvatar(id);
      const codes = codesOf(cells);
      expect(codes.size).toBe(1);
      expect(AVATAR_DEFAULT_COLOURS.map(avatarCode)).toContain([...codes][0]);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          expect(cells[cellAt(x, y)]).toBe(cells[cellAt(15 - x, y)]);
          if (x < 2 || y < 2 || x > 13 || y > 13) expect(cells[cellAt(x, y)]).toBe(".");
        }
      }
    }
  });

  it("is only used when the person never drew one", () => {
    const drawn = "8".repeat(256);
    expect(avatarFor(drawn, 7).join("")).toBe(drawn);
    expect(avatarFor(null, 7)).toEqual(defaultAvatar(7));
    expect(avatarFor("broken", 7)).toEqual(defaultAvatar(7));
  });
});

describe("presets", () => {
  it("are 16 rows of 16 palette codes, never empty, each with its own name", () => {
    expect(new Set(AVATAR_PRESETS.map((preset) => preset.name)).size).toBe(AVATAR_PRESETS.length);
    for (const preset of AVATAR_PRESETS) {
      expect(preset.rows.map((row) => row.length)).toEqual(Array(16).fill(16));
      const avatar = preset.rows.join("");
      expect(AVATAR_PATTERN.test(avatar)).toBe(true);
      expect(toAvatar(toCells(avatar))).toBe(avatar);
    }
  });

  it("fills every empty cell with the background, so they look the same on every theme", () => {
    for (const preset of AVATAR_PRESETS) {
      const drawn = preset.rows.join("");
      const background = avatarCode(preset.background);
      const cells = presetCells(preset.rows, preset.background);
      expect(cells).not.toContain(".");
      expect(cells.join("")).toBe(drawn.replaceAll(".", background));
      expect(drawn).not.toContain(background);
    }
  });
});
