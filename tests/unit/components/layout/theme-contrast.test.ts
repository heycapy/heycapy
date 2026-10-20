import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/components/layout/settings-constants";

// WCAG AA for normal text; the primary colour is used for small text on the page, on cards and under button labels
const MIN_CONTRAST = 4.5;

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function themeColors(id: string): Record<string, string> {
  const block = css.match(new RegExp(`\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`no [data-theme="${id}"] block in globals.css`);
  return Object.fromEntries(
    [...block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()])
  );
}

function toRgb(color: string): number[] {
  if (color.startsWith("#")) {
    return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  }
  const hsl = color.match(/^hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)$/);
  if (!hsl) throw new Error(`can't read colour ${color}`);
  const [h, s, l] = [Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100];
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

function luminance(color: string): number {
  const [r, g, b] = toRgb(color).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("theme contrast", () => {
  it.each(THEMES.map((theme) => theme.id))("%s keeps primary text readable", (id) => {
    const colors = themeColors(id);
    expect
      .soft(contrast(colors.primary, colors.background), "primary on the page")
      .toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect
      .soft(contrast(colors.primary, colors.card), "primary on a card")
      .toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect
      .soft(contrast(colors["primary-foreground"], colors.primary), "a button label")
      .toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
