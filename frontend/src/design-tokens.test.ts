/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Guards WCAG AA for the color tokens as they are written in index.css (DESIGN.md, Contrast
 * check). Same pairs as scripts/contrast.mjs: text >= 4.5:1, non-text UI >= 3:1.
 */
// Vitest runs from frontend/ (import.meta.url is not a file: URL under jsdom).
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

function readBlock(selector: ":root" | ".dark"): Record<string, string> {
  const escaped = selector.replace(".", "\\.");
  const block = new RegExp(`^${escaped} \\{([^}]*)\\}`, "m").exec(css)?.[1];
  if (!block) throw new Error(`No ${selector} block in index.css`);
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, hex]) => [
      name,
      hex!.toLowerCase(),
    ]),
  );
}

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => channel(parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const TEXT = 4.5;
const UI = 3;

const PAIRS: [string, string, number][] = [
  ["foreground", "background", TEXT],
  ["foreground", "card", TEXT],
  ["card-foreground", "card", TEXT],
  ["popover-foreground", "popover", TEXT],
  ["muted-foreground", "card", TEXT],
  ["muted-foreground", "background", TEXT],
  ["muted-foreground", "muted", TEXT],
  ["secondary-foreground", "secondary", TEXT],
  ["primary", "background", TEXT],
  ["primary", "card", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["primary-foreground", "primary-hover", TEXT],
  ["accent-foreground", "accent", TEXT],
  ["destructive", "card", TEXT],
  ["destructive-foreground", "destructive", TEXT],
  ["detained", "detained-soft", TEXT],
  ["detained", "card", TEXT],
  ["deadline", "deadline-soft", TEXT],
  ["deadline", "card", TEXT],
  ["status-programada", "status-programada-soft", TEXT],
  ["status-reprogramada", "status-reprogramada-soft", TEXT],
  ["status-efectiva", "status-efectiva-soft", TEXT],
  ["status-suspendida", "status-suspendida-soft", TEXT],
  ["sidebar-foreground", "sidebar", TEXT],
  ["sidebar-primary-foreground", "sidebar-primary", TEXT],
  ["sidebar-accent-foreground", "sidebar-accent", TEXT],
  ["ring", "background", UI],
  ["ring", "card", UI],
  ["border-strong", "card", UI],
  ["border-strong", "background", UI],
  ["detained-edge", "card", UI],
  ["detained-edge", "detained-soft", UI],
  ["deadline-edge", "card", UI],
  ["chart-1", "card", UI],
  ["chart-2", "card", UI],
  ["chart-3", "card", UI],
  ["chart-4", "card", UI],
  ["chart-5", "card", UI],
];

describe.each([
  ["light", readBlock(":root")],
  ["dark", readBlock(".dark")],
])("%s theme tokens", (_theme, tokens) => {
  it("defines every token both themes need", () => {
    const missing = [...new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]))].filter(
      (name) => !tokens[name],
    );
    expect(missing).toEqual([]);
  });

  it.each(PAIRS)("%s on %s meets %s:1", (fg, bg, minimum) => {
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(minimum);
  });
});

describe("theme parity", () => {
  it("dark mode overrides every light color token", () => {
    const light = Object.keys(readBlock(":root")).sort();
    const dark = Object.keys(readBlock(".dark")).sort();
    expect(dark).toEqual(light);
  });
});
