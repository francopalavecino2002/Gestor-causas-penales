/// <reference lib="dom" />
import { test, type Page } from "@playwright/test";

import { DETAINEE_ALERTS, FIXTURE_NOW, WEEK_HEARINGS } from "../src/test/agenda-fixtures";
import { CASE_EJEMPLAR, CASE_MODELO } from "../src/test/case-fixtures";
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

/** Signed in on Monday 23 November 2026 at 10:20 in Neuquén, with the fixtures' week. */
const agendaWeek =
  (extra: { hearings?: boolean; alerts?: boolean; fails?: boolean } = {}) =>
  async (page: Page) => {
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, {
      signedIn: true,
      hearings: extra.hearings === false ? [] : WEEK_HEARINGS,
      detaineeAlerts: extra.alerts === false ? [] : DETAINEE_ALERTS,
      agendaFails: extra.fails,
    });
  };

const waitForHearings = (page: Page) => page.getByRole("article").first().waitFor();

/** Cards on phones, the table on desktops: wait for whichever this viewport shows. */
const waitForArticleOrTable = (page: Page) =>
  page.locator("article:visible, table:visible").first().waitFor();

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
  t22: [
    { path: "/", name: "agenda-today", prepare: agendaWeek(), act: waitForHearings },
    {
      path: "/?vista=semana",
      name: "agenda-week",
      prepare: agendaWeek(),
      act: waitForHearings,
    },
    {
      path: "/?vista=semana",
      name: "agenda-week-scrolled",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await waitForHearings(page);
        await page.evaluate(() => window.scrollTo(0, 1400));
      },
      fullPage: false,
    },
    {
      path: "/",
      name: "agenda-empty",
      themes: ["light"],
      prepare: agendaWeek({ hearings: false, alerts: false }),
      act: (page) => page.getByRole("heading", { name: "No tenés audiencias hoy" }).waitFor(),
    },
    {
      path: "/",
      name: "agenda-error",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: agendaWeek({ fails: true, alerts: false }),
      act: (page) => page.getByText("No pudimos cargar la agenda").waitFor({ timeout: 15_000 }),
    },
  ],
  t23: [
    {
      path: "/causas",
      name: "case-list",
      prepare: agendaWeek(),
      act: waitForArticleOrTable,
    },
    {
      path: "/causas?q=inexistente",
      name: "case-list-empty-search",
      themes: ["light"],
      prepare: agendaWeek(),
      act: (page) => page.getByRole("heading", { name: /No encontramos causas/ }).waitFor(),
    },
    {
      path: "/causas",
      name: "case-list-error",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: async (page) => {
        await page.clock.setFixedTime(new Date(FIXTURE_NOW));
        await mockBackend(page, { signedIn: true, casesFail: true });
      },
      act: (page) => page.getByText("No pudimos cargar las causas").waitFor({ timeout: 15_000 }),
    },
    {
      path: `/causas/${CASE_MODELO.id}`,
      name: "case-detail",
      prepare: agendaWeek(),
      act: (page) => page.getByText("En prisión preventiva").first().waitFor(),
    },
    {
      path: `/causas/${CASE_EJEMPLAR.id}`,
      name: "case-detail-reserved",
      themes: ["light"],
      prepare: agendaWeek(),
      act: (page) => page.getByText("Prófugo o rebelde").first().waitFor(),
    },
    {
      path: "/causas/00000000-0000-4000-a000-999999999999",
      name: "case-not-found",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: agendaWeek(),
      fullPage: false,
    },
  ],
  t24: [
    {
      path: "/plazos",
      name: "deadlines",
      prepare: agendaWeek(),
      act: waitForHearings,
    },
    {
      path: "/plazos?detenidos=si",
      name: "deadlines-detainees",
      themes: ["light"],
      prepare: agendaWeek(),
      act: waitForHearings,
    },
    {
      path: "/plazos?dias=7",
      name: "deadlines-empty",
      themes: ["light"],
      prepare: async (page) => {
        await page.clock.setFixedTime(new Date(FIXTURE_NOW));
        await mockBackend(page, { signedIn: true, deadlines: [] });
      },
      act: (page) => page.getByRole("heading", { name: /No hay plazos/ }).waitFor(),
    },
    {
      path: "/plazos",
      name: "deadlines-error",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: async (page) => {
        await page.clock.setFixedTime(new Date(FIXTURE_NOW));
        await mockBackend(page, { signedIn: true, deadlinesFail: true });
      },
      act: (page) => page.getByText("No pudimos cargar los plazos").waitFor({ timeout: 15_000 }),
    },
    {
      path: `/causas/${CASE_MODELO.id}`,
      name: "case-detail-deadlines",
      prepare: agendaWeek(),
      act: async (page) => {
        const section = page.getByRole("region", { name: "Plazos", exact: true });
        await section.getByRole("article").first().waitFor();
        // The section's heading near the top, below the mobile top bar.
        await section.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 80),
        );
      },
      fullPage: true,
    },
  ],
  t25: [
    { path: "/ajustes", name: "settings-index", prepare: agendaWeek() },
    {
      path: "/ajustes/catalogos",
      name: "settings-catalogs",
      prepare: agendaWeek(),
      act: (page) => page.getByRole("listitem").first().waitFor(),
    },
    {
      path: "/ajustes/catalogos",
      name: "settings-catalog-rename",
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page
          .getByRole("listitem", { name: "Revisión de la preventiva" })
          .getByRole("button", { name: "Renombrá" })
          .click();
        await page.getByRole("dialog").waitFor();
      },
      fullPage: false,
    },
    {
      path: "/ajustes/campos",
      name: "settings-fields",
      prepare: agendaWeek(),
      act: (page) => page.getByRole("region", { name: "En uso" }).waitFor(),
    },
    {
      path: "/ajustes/campos",
      name: "settings-field-create",
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page.getByRole("button", { name: "Agregá un campo" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByText("Lista de opciones").click();
        await dialog.getByRole("button", { name: "Agregá el campo" }).click();
        await dialog.getByText("Escribí el nombre del campo.").waitFor();
      },
      fullPage: false,
    },
    {
      path: "/ajustes/plazos",
      name: "settings-deadline-rules",
      prepare: agendaWeek(),
      act: waitForHearings,
    },
    { path: "/ajustes/usuarios", name: "settings-users", prepare: agendaWeek() },
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
