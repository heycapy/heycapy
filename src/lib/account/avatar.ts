import { AVATAR_EMPTY, AVATAR_PALETTE, AVATAR_SIZE } from "./constants";

export type AvatarCells = readonly string[];
export type AvatarRun = { x: number; y: number; width: number; fill: string };

const CELLS = AVATAR_SIZE * AVATAR_SIZE;
// Base 36 keeps one character per cell for up to 36 colours
const CODES = AVATAR_PALETTE.map((_, index) => index.toString(36));

export const AVATAR_PATTERN = new RegExp(`^[${CODES.join("")}${AVATAR_EMPTY}]{${CELLS}}$`);

export function avatarCode(paletteIndex: number): string {
  return CODES[paletteIndex];
}

function fillOf(code: string): string | null {
  const index = CODES.indexOf(code);
  return index === -1 ? null : AVATAR_PALETTE[index].fill;
}

export function blankCells(): AvatarCells {
  return Array<string>(CELLS).fill(AVATAR_EMPTY);
}

export function toCells(avatar: string | null): AvatarCells {
  return avatar !== null && AVATAR_PATTERN.test(avatar) ? [...avatar] : blankCells();
}

// A drawing with nothing on it is saved as no avatar
export function toAvatar(cells: AvatarCells): string | null {
  return cells.every((cell) => cell === AVATAR_EMPTY) ? null : cells.join("");
}

export function cellAt(x: number, y: number): number {
  return y * AVATAR_SIZE + x;
}

function mirrorOf(index: number): number {
  const x = index % AVATAR_SIZE;
  return index - x + (AVATAR_SIZE - 1 - x);
}

export function paint(
  cells: AvatarCells,
  indexes: readonly number[],
  code: string,
  mirror: boolean
): AvatarCells {
  const next = [...cells];
  for (const index of indexes) {
    next[index] = code;
    if (mirror) next[mirrorOf(index)] = code;
  }
  return next;
}

function neighbours(index: number): number[] {
  const x = index % AVATAR_SIZE;
  const result: number[] = [];
  if (x > 0) result.push(index - 1);
  if (x < AVATAR_SIZE - 1) result.push(index + 1);
  if (index >= AVATAR_SIZE) result.push(index - AVATAR_SIZE);
  if (index < CELLS - AVATAR_SIZE) result.push(index + AVATAR_SIZE);
  return result;
}

function region(cells: AvatarCells, start: number): number[] {
  const target = cells[start];
  const seen = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbours(queue[i])) {
      if (!seen.has(next) && cells[next] === target) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return queue;
}

export function fill(
  cells: AvatarCells,
  start: number,
  code: string,
  mirror: boolean
): AvatarCells {
  const indexes = region(cells, start);
  if (mirror) indexes.push(...region(cells, mirrorOf(start)));
  return paint(cells, indexes, code, false);
}

// Every cell on the straight line between two cells, so a fast drag leaves no gaps
export function cellsBetween(from: number, to: number): number[] {
  let x = from % AVATAR_SIZE;
  let y = Math.floor(from / AVATAR_SIZE);
  const endX = to % AVATAR_SIZE;
  const endY = Math.floor(to / AVATAR_SIZE);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = dx + dy;
  const result = [cellAt(x, y)];
  while (x !== endX || y !== endY) {
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
    result.push(cellAt(x, y));
  }
  return result;
}

// Neighbouring cells of one colour in a row become one rect, so a drawing is a few dozen nodes
export function avatarRuns(cells: AvatarCells): AvatarRun[] {
  const runs: AvatarRun[] = [];
  for (let y = 0; y < AVATAR_SIZE; y++) {
    let x = 0;
    while (x < AVATAR_SIZE) {
      const code = cells[cellAt(x, y)];
      let width = 1;
      while (x + width < AVATAR_SIZE && cells[cellAt(x + width, y)] === code) width++;
      const fill = fillOf(code);
      if (fill) runs.push({ x, y, width, fill });
      x += width;
    }
  }
  return runs;
}
