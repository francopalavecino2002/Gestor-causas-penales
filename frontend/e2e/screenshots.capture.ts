/// <reference lib="dom" />
import { test, type Page } from "@playwright/test";

import { DEMO_ME, mockBackend } from "./mock-backend";

/*
 * Captures the screens of each task for its PR. Not a regression check: it is excluded from
 * `npm run test:e2e` and runs with `npm run screenshots` (playwright.screenshots.config.ts).
 * Set CAPTURE_SCREENSHOTS=<task id> to capture a single task. Files land in
 * docs/screenshots/<task id>/ at the repository root.
 */

type ViewportName = "mobile" | "desktop";
type Theme = "light" | "dark";

interface Screen {
  path: string;
  name: string;
  /** Defaults to both viewports and both themes. */
  viewports?: ViewportName[];
  themes?: Theme[];
  /** Runs before navigating (e.g. mock the API). */
  prepare?: (page: Page) => Promise<unknown>;
  /** Runs after the page loads (e.g. open a menu). */
  act?: (page: Page) => Promise<unknown>;
  /** Skip the full-page capture (open menus and short screens). */
  fullPage?: boolean;
}

const OTHER_FIRMS = [
  { slug: "estudio-norte", name: "Estudio Norte (ficticio)", lastEmail: "lucia.norte@example.com" },
  { slug: DEMO_ME.tenant.slug, name: DEMO_ME.tenant.name, lastEmail: DEMO_ME.email },
];

const rememberFirms = (page: Page) =>
  page.addInitScript((firms) => {
    window.localStorage.setItem("rememberedFirms", JSON.stringify(firms));
  }, OTHER_FIRMS);

const signedIn = async (page: Page) => {
  await rememberFirms(page);
  await mockBackend(page, { signedIn: true });
};

async function fillLogin(page: Page, email: string) {
  await page.getByLabel("Estudio", { exact: true }).fill(DEMO_ME.tenant.slug);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("una-clave-ficticia");
  await page.getByRole("button", { name: "Ingresá" }).click();
}

const SCREENS: Record<string, Screen[]> = {
  t20: [{ path: "/design-system", name: "design-system" }],
  t21: [
    {
      path: "/ingresar",
      name: "login",
      themes: ["light"],
      prepare: (page) => mockBackend(page),
      fullPage: false,
    },
    {
      path: "/ingresar",
      name: "login",
      viewports: ["desktop"],
      themes: ["dark"],
      prepare: (page) => mockBackend(page),
      fullPage: false,
    },
    {
      path: "/ingresar",
      name: "login-remembered-firms",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: async (page) => {
        await rememberFirms(page);
        await mockBackend(page);
      },
    },
    {
      path: "/ingresar",
      name: "login-error",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: (page) => mockBackend(page),
      act: async (page) => {
        await fillLogin(page, "otra.persona@example.com");
        await page.getByRole("alert").waitFor();
      },
    },
    {
      path: "/ingresar",
      name: "second-factor",
      themes: ["light"],
      prepare: (page) => mockBackend(page, { secondFactor: true }),
      act: async (page) => {
        await fillLogin(page, DEMO_ME.email);
        await page.getByLabel("Código de verificación").waitFor();
      },
      fullPage: false,
    },
    { path: "/", name: "shell-agenda", prepare: signedIn },
    {
      path: "/causas",
      name: "firm-switcher-open",
      themes: ["light"],
      prepare: signedIn,
      act: async (page) => {
        await page.getByRole("button", { name: /Cambiar de estudio/ }).click();
        await page.getByRole("menu").waitFor();
      },
      fullPage: false,
    },
    {
      path: "/causas",
      name: "user-menu-open",
      themes: ["light", "dark"],
      prepare: signedIn,
      act: async (page) => {
        await page.getByRole("button", { name: /Tu cuenta/ }).click();
        await page.getByRole("menu").waitFor();
      },
      fullPage: false,
    },
  ],
};

const VIEWPORTS: Record<ViewportName, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

const only = process.env.CAPTURE_SCREENSHOTS;
const tasks = Object.keys(SCREENS).filter((task) => !only || task === only);

for (const task of tasks) {
  for (const screen of SCREENS[task] ?? []) {
    for (const viewportName of screen.viewports ?? (["mobile", "desktop"] as const)) {
      for (const theme of screen.themes ?? (["light", "dark"] as const)) {
        test(`${task} ${screen.name} ${viewportName} ${theme}`, async ({ browser }) => {
          const context = await browser.newContext({
            viewport: VIEWPORTS[viewportName],
            colorScheme: theme,
            reducedMotion: "reduce",
            locale: "es-AR",
            timezoneId: "America/Argentina/Buenos_Aires",
          });
          const page = await context.newPage();
          await screen.prepare?.(page);
          await page.goto(screen.path);
          await page.evaluate(() => document.fonts.ready);
          await page.locator("h1").first().waitFor();
          await screen.act?.(page);
          // Let effects that run on the next frame (e.g. token values in the guide) settle.
          await page.evaluate(
            () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
          );
          const base = `../docs/screenshots/${task}/${screen.name}-${viewportName}-${theme}`;
          await page.screenshot({ path: `${base}.png` });
          if (screen.fullPage ?? true) {
            await page.screenshot({ path: `${base}-full.png`, fullPage: true });
          }
          await context.close();
        });
      }
    }
  }
}
