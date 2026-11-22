/// <reference lib="dom" />
import { test } from "@playwright/test";

/*
 * Captures the screens of each task for its PR. Not a regression check: it is excluded from
 * `npm run test:e2e` and runs with `npm run screenshots` (playwright.screenshots.config.ts).
 * Set CAPTURE_SCREENSHOTS=<task id> to capture a single task. Files land in
 * docs/screenshots/<task id>/ at the repository root.
 */
const SCREENS: Record<string, { path: string; name: string }[]> = {
  t20: [{ path: "/design-system", name: "design-system" }],
};

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const THEMES = ["light", "dark"] as const;

const only = process.env.CAPTURE_SCREENSHOTS;
const tasks = Object.keys(SCREENS).filter((task) => !only || task === only);

for (const task of tasks) {
  for (const screen of SCREENS[task] ?? []) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        test(`${task} ${screen.name} ${viewport.name} ${theme}`, async ({ browser }) => {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            colorScheme: theme,
            reducedMotion: "reduce",
            locale: "es-AR",
            timezoneId: "America/Argentina/Buenos_Aires",
          });
          const page = await context.newPage();
          await page.goto(screen.path);
          await page.evaluate(() => document.fonts.ready);
          // Let effects that run on the next frame (e.g. token values in the guide) settle.
          await page.evaluate(
            () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
          );
          const base = `../docs/screenshots/${task}/${screen.name}-${viewport.name}-${theme}`;
          await page.screenshot({ path: `${base}.png` });
          await page.screenshot({ path: `${base}-full.png`, fullPage: true });
          await context.close();
        });
      }
    }
  }
}
