#!/usr/bin/env node
// Measures WCAG 2.x contrast ratios of the design tokens in docs/design/DESIGN.md.
// Plain Node, no dependencies. Usage: node scripts/contrast.mjs
// Prints one Markdown table per theme and exits with code 1 if any pair is below its minimum
// (4.5:1 for text, 3:1 for non-text UI such as borders, edges and chart marks).
// Keep TOKENS in sync with DESIGN.md; T20 adds a test that checks the same pairs in index.css.

const TOKENS = {
  light: {
    background: "#F4F7F8",
    foreground: "#13232B",
    card: "#FFFFFF",
    "card-foreground": "#13232B",
    popover: "#FFFFFF",
    "popover-foreground": "#13232B",
    primary: "#0B5267",
    "primary-hover": "#08404F",
    "primary-foreground": "#FFFFFF",
    secondary: "#EAF0F2",
    "secondary-foreground": "#13232B",
    muted: "#EAF0F2",
    "muted-foreground": "#475862",
    accent: "#E0EDF1",
    "accent-foreground": "#0B5267",
    destructive: "#A3191E",
    "destructive-foreground": "#FFFFFF",
    border: "#CCD7DC",
    "border-strong": "#7A8E98",
    ring: "#0B5267",
    detained: "#A3191E",
    "detained-soft": "#FBE9E8",
    "detained-edge": "#C4282D",
    deadline: "#7A4600",
    "deadline-soft": "#FFF2D9",
    "deadline-edge": "#B07612",
    "status-programada": "#0B5267",
    "status-programada-soft": "#E0EDF1",
    "status-reprogramada": "#5B3A96",
    "status-reprogramada-soft": "#EEE8F8",
    "status-efectiva": "#1B6436",
    "status-efectiva-soft": "#E2F2E7",
    "status-suspendida": "#4C4F55",
    "status-suspendida-soft": "#ECEDEF",
    sidebar: "#FFFFFF",
    "sidebar-foreground": "#13232B",
    "sidebar-primary": "#0B5267",
    "sidebar-primary-foreground": "#FFFFFF",
    "sidebar-accent": "#E0EDF1",
    "sidebar-accent-foreground": "#0B5267",
    "sidebar-border": "#CCD7DC",
    "sidebar-ring": "#0B5267",
    "chart-1": "#0B5267",
    "chart-2": "#B07612",
    "chart-3": "#5B3A96",
    "chart-4": "#1B6436",
    "chart-5": "#7A8E98",
  },
  dark: {
    background: "#0D171C",
    foreground: "#E4ECEF",
    card: "#142229",
    "card-foreground": "#E4ECEF",
    popover: "#142229",
    "popover-foreground": "#E4ECEF",
    primary: "#7CC6DA",
    "primary-hover": "#9AD5E5",
    "primary-foreground": "#08222B",
    secondary: "#1B2C34",
    "secondary-foreground": "#E4ECEF",
    muted: "#1B2C34",
    "muted-foreground": "#A3B4BC",
    accent: "#16343F",
    "accent-foreground": "#9AD5E5",
    destructive: "#FF8A84",
    "destructive-foreground": "#2A0A0B",
    border: "#2A3D46",
    "border-strong": "#62808D",
    ring: "#7CC6DA",
    detained: "#FFB3AE",
    "detained-soft": "#3A1517",
    "detained-edge": "#E5484D",
    deadline: "#F5C979",
    "deadline-soft": "#33260F",
    "deadline-edge": "#C98A1B",
    "status-programada": "#9AD5E5",
    "status-programada-soft": "#16343F",
    "status-reprogramada": "#CDB8F5",
    "status-reprogramada-soft": "#2C2342",
    "status-efectiva": "#9FDCB2",
    "status-efectiva-soft": "#16301F",
    "status-suspendida": "#C5C9CF",
    "status-suspendida-soft": "#262B30",
    sidebar: "#142229",
    "sidebar-foreground": "#E4ECEF",
    "sidebar-primary": "#7CC6DA",
    "sidebar-primary-foreground": "#08222B",
    "sidebar-accent": "#16343F",
    "sidebar-accent-foreground": "#9AD5E5",
    "sidebar-border": "#2A3D46",
    "sidebar-ring": "#7CC6DA",
    "chart-1": "#7CC6DA",
    "chart-2": "#F5C979",
    "chart-3": "#CDB8F5",
    "chart-4": "#9FDCB2",
    "chart-5": "#A3B4BC",
  },
};

const TEXT = 4.5;
const UI = 3;

// [foreground token, background token, minimum]
const PAIRS = [
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
  ["destructive-foreground", "destructive", TEXT],
  ["detained", "detained-soft", TEXT],
  ["detained", "card", TEXT],
  ["deadline", "deadline-soft", TEXT],
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

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map((h) => channel(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

let failures = 0;
for (const [theme, tokens] of Object.entries(TOKENS)) {
  console.log(`\n### ${theme}\n`);
  console.log("| Foreground | Background | Ratio | Minimum | Result |");
  console.log("|---|---|---|---|---|");
  for (const [fg, bg, min] of PAIRS) {
    const value = ratio(tokens[fg], tokens[bg]);
    const ok = value >= min;
    if (!ok) failures += 1;
    console.log(`| ${fg} | ${bg} | ${value.toFixed(2)} | ${min} | ${ok ? "pass" : "FAIL"} |`);
  }
}
if (failures > 0) {
  console.error(`\n${failures} pair(s) below the minimum.`);
  process.exit(1);
}
console.log("\nAll pairs meet WCAG AA.");
