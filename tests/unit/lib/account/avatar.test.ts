import { describe, expect, it } from "vitest";
import {
  AVATAR_PATTERN,
  avatarCode,
  avatarRuns,
  blankCells,
  cellAt,
  cellsBetween,
  fill,
  paint,
  toAvatar,
  toCells,
} from "@/lib/account/avatar";
import { AVATAR_PALETTE } from "@/lib/account/constants";

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
