/// <reference lib="dom" />
import { test, type Page } from "@playwright/test";

import {
  DETAINEE_ALERTS,
  FIXTURE_NOW,
  hearing,
  LAWYER_PAULA,
  WEEK_HEARINGS,
} from "../src/test/agenda-fixtures";
import { ALL_TASKS } from "../src/test/task-fixtures";
import { ALL_DUE_SOON, ALL_NEWS } from "../src/test/news-fixtures";
import { CASE_CIVIL } from "../src/test/area-fixtures";
import type { JusValueView } from "../src/features/fees/fee-types";
import { ALL_JUS_VALUES, MIN_EXCARCELACION } from "../src/test/fee-fixtures";
import { CASE_EJEMPLAR, CASE_MODELO } from "../src/test/case-fixtures";
import { ALL_PERSONS, PERSON_JULIAN } from "../src/test/person-fixtures";
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

/** The agenda week with a civil hearing, for a firm that works in two areas (T43). */
const twoAreas = async (page: Page) => {
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, {
    signedIn: true,
    areas: ["penal", "civil"],
    hearings: [
      ...WEEK_HEARINGS,
      hearing("2026-11-23T12:30", {
        caseId: CASE_CIVIL.id,
        caseCaption: CASE_CIVIL.caption,
        practiceArea: "civil",
        typeCode: "preliminar",
        typeName: "Audiencia preliminar",
        typeArticle: null,
        room: "Sala civil 2 (ficticia)",
        defendants: [],
      }),
    ],
    detaineeAlerts: DETAINEE_ALERTS,
  });
};

const waitForHearings = (page: Page) => page.getByRole("article").first().waitFor();

/** The agenda week with the fictitious tasks (T47): two due today, one overdue, one done. */
const withTasks = async (page: Page) => {
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, {
    signedIn: true,
    hearings: WEEK_HEARINGS,
    detaineeAlerts: DETAINEE_ALERTS,
    tasks: ALL_TASKS,
  });
};

/** The agenda week, the tasks and the fictitious news wall (T49). */
const withNews = async (page: Page) => {
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, {
    signedIn: true,
    hearings: WEEK_HEARINGS,
    detaineeAlerts: DETAINEE_ALERTS,
    tasks: ALL_TASKS,
    news: ALL_NEWS,
    dueSoon: ALL_DUE_SOON,
  });
};

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
  t26: [
    { path: "/importar", name: "import-kind", prepare: agendaWeek() },
    {
      path: "/importar",
      name: "import-file",
      prepare: agendaWeek(),
      act: (page) => chooseImportKind(page, "Personas"),
    },
    {
      path: "/importar",
      name: "import-file-invalid",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await chooseImportKind(page, "Personas");
        await uploadImport(page, "personas.xls");
        await page.getByRole("alert").waitFor();
      },
    },
    {
      path: "/importar",
      name: "import-review-errors",
      prepare: agendaWeek(),
      act: async (page) => {
        await chooseImportKind(page, "Personas");
        await uploadImport(page, "personas-con-errores.csv");
        await page.getByRole("table").waitFor();
      },
    },
    {
      path: "/importar",
      name: "import-review-ready",
      prepare: agendaWeek(),
      act: async (page) => {
        await chooseImportKind(page, "Causas");
        await uploadImport(page, "causas.xlsx");
        await page.getByRole("button", { name: /Confirmá e importá/ }).waitFor();
      },
    },
    {
      path: "/importar",
      name: "import-done",
      prepare: agendaWeek(),
      act: async (page) => {
        await chooseImportKind(page, "Causas");
        await uploadImport(page, "causas.xlsx");
        await page.getByRole("button", { name: /Confirmá e importá/ }).click();
        await page.getByRole("heading", { name: /Listo/ }).waitFor();
        await page.mouse.move(0, 0);
      },
    },
    {
      path: "/importar",
      name: "import-not-allowed",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: async (page) => {
        await mockBackend(page, { signedIn: true, role: "PARALEGAL" });
      },
      fullPage: false,
    },
  ],
  t35: [
    {
      path: "/causas",
      name: "case-new",
      themes: ["light", "dark"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page.getByRole("button", { name: "Nueva causa" }).click();
        await page.getByRole("dialog").getByLabel("Carátula").waitFor();
      },
      fullPage: false,
    },
    {
      path: "/causas",
      name: "case-new-with-defendant",
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page.getByRole("button", { name: "Nueva causa" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Carátula").fill("Prueba, Lisandro s/ hurto (ficticio)");
        await dialog.getByLabel("Circunscripción").selectOption("ii-comarca");
        await dialog.getByRole("checkbox", { name: "Agregá ahora al primer imputado" }).click();
        await dialog.getByRole("radio", { name: "Es una persona nueva" }).check();
        await dialog.getByLabel("Apellidos").fill("Prueba");
        await dialog.getByLabel("Número de documento").fill("12");
        await dialog.getByRole("button", { name: "Guardá la causa" }).click();
        await dialog.getByText("El DNI tiene 7 u 8 números.").waitFor();
        await dialog.getByLabel("Apellidos").scrollIntoViewIfNeeded();
      },
      fullPage: false,
    },
    {
      path: "/causas",
      name: "case-new-errors",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page.getByRole("button", { name: "Nueva causa" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Legajo del MPF").fill("12345");
        await dialog.getByRole("button", { name: "Guardá la causa" }).click();
        await dialog.getByText("Escribí la carátula.").waitFor();
      },
      fullPage: false,
    },
    {
      path: `/causas/${CASE_MODELO.id}`,
      name: "case-detail-actions",
      themes: ["light"],
      prepare: agendaWeek(),
    },
    {
      path: `/causas/${CASE_MODELO.id}`,
      name: "case-edit",
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page.getByRole("button", { name: "Editá la causa" }).click();
        await page.getByRole("dialog").getByLabel("Carátula").waitFor();
      },
      fullPage: false,
    },
    {
      path: `/causas/${CASE_MODELO.id}`,
      name: "defendant-add",
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page.getByRole("button", { name: "Agregá un imputado" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Buscá por nombre o documento").fill("Fict");
        await dialog.getByRole("radio", { name: /Ficticio, Julián/ }).waitFor();
      },
      fullPage: false,
    },
    {
      path: `/causas/${CASE_EJEMPLAR.id}`,
      name: "defendant-edit",
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page.getByRole("button", { name: "Editá a Nora Ficticia" }).click();
        await page.getByRole("dialog").getByLabel("Estado del proceso").waitFor();
      },
      fullPage: false,
    },
    {
      path: "/",
      name: "hearing-new-agenda",
      themes: ["light", "dark"],
      prepare: agendaWeek({ hearings: true }),
      act: async (page) => {
        await page
          .getByRole("button", { name: "Cargá una audiencia" })
          .filter({ visible: true })
          .first()
          .click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Buscá la causa").fill("Modelo");
        await dialog.getByRole("radio", { name: new RegExp(CASE_MODELO.caption) }).click();
        await dialog.getByRole("checkbox", { name: /Lucía Ejemplo/ }).waitFor();
        await dialog.getByLabel("Tipo de audiencia").selectOption("control-de-acusacion");
        await dialog.getByLabel("Hora").fill("12:30");
      },
      fullPage: false,
    },
    {
      path: "/",
      name: "agenda-with-new-button",
      themes: ["light"],
      prepare: agendaWeek({ hearings: true }),
    },
    {
      path: `/causas/${CASE_MODELO.id}`,
      name: "hearing-edit-reschedule",
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        await page
          .getByRole("button", { name: "Editá la audiencia Revisión de prisión preventiva" })
          .click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Hora").fill("11:30");
        await dialog.getByLabel("Motivo de la reprogramación").waitFor();
      },
      fullPage: false,
    },
  ],
  t43: [
    {
      path: "/causas",
      name: "case-new-civil",
      themes: ["light"],
      prepare: twoAreas,
      act: async (page) => {
        await page.getByRole("button", { name: "Nueva causa" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("radio", { name: /Civil y comercial/ }).check();
        await dialog.getByLabel("Tipo de proceso").waitFor();
        await dialog.getByLabel("Carátula").fill("Muestra, Ana c/ Demo, Ramiro s/ daños");
        await dialog.getByLabel("Circunscripción").selectOption("confluencia");
        await dialog
          .getByRole("group", { name: "¿De qué fuero es la causa?" })
          .scrollIntoViewIfNeeded();
      },
      fullPage: false,
    },
    {
      path: "/causas",
      name: "case-new-civil-party",
      themes: ["light"],
      prepare: twoAreas,
      act: async (page) => {
        await page.getByRole("button", { name: "Nueva causa" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByRole("radio", { name: /Civil y comercial/ }).check();
        await dialog.getByLabel("Tipo de proceso").waitFor();
        await dialog.getByRole("checkbox", { name: "Agregá ahora a la primera parte" }).click();
        await dialog.getByRole("radio", { name: "Es una persona nueva" }).check();
        await dialog.getByLabel("Rol en la causa").scrollIntoViewIfNeeded();
      },
      fullPage: false,
    },
    {
      path: `/causas/${CASE_CIVIL.id}`,
      name: "case-detail-civil",
      prepare: twoAreas,
      act: (page) => page.getByRole("region", { name: "Etapa y estado" }).waitFor(),
    },
    {
      path: "/?fuero=civil",
      name: "agenda-area-filter",
      prepare: twoAreas,
      act: waitForHearings,
    },
    {
      path: "/causas",
      name: "case-list-areas",
      themes: ["light"],
      prepare: twoAreas,
      act: waitForArticleOrTable,
    },
    {
      path: "/ajustes/fueros",
      name: "settings-areas",
      prepare: twoAreas,
      act: (page) => page.getByRole("switch").first().waitFor(),
    },
  ],
  t45: [
    {
      path: "/ajustes/calendario",
      name: "calendar-link-created",
      prepare: agendaWeek(),
      act: async (page) => {
        await page.getByRole("button", { name: "Creá tu enlace" }).click();
        await page.getByLabel("Tu enlace privado").waitFor();
        await page.evaluate(() => window.scrollTo(0, 0));
      },
    },
    {
      path: "/ajustes/calendario",
      name: "calendar-link-none",
      themes: ["light"],
      prepare: agendaWeek(),
      act: (page) => page.getByRole("button", { name: "Creá tu enlace" }).waitFor(),
    },
    {
      path: "/ajustes/calendario",
      name: "calendar-link-active",
      themes: ["light"],
      prepare: async (page) => {
        await page.clock.setFixedTime(new Date(FIXTURE_NOW));
        await mockBackend(page, { signedIn: true, calendarFeedSince: "2026-11-20T12:05:00Z" });
      },
      act: (page) => page.getByText(/Tenés un enlace activo/).waitFor(),
    },
    {
      path: "/ajustes/calendario",
      name: "calendar-link-regenerate",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: async (page) => {
        await page.clock.setFixedTime(new Date(FIXTURE_NOW));
        await mockBackend(page, { signedIn: true, calendarFeedSince: "2026-11-20T12:05:00Z" });
      },
      act: async (page) => {
        await page.getByRole("button", { name: "Generá un enlace nuevo" }).click();
        await page.getByRole("dialog").waitFor();
      },
      fullPage: false,
    },
    {
      path: "/",
      name: "agenda-add-to-calendar",
      prepare: agendaWeek(),
      act: async (page) => {
        const button = page
          .getByRole("button", { name: /^Agregá al calendario la audiencia Revisión/ })
          .first();
        await button.waitFor();
        await button.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 420),
        );
      },
      fullPage: false,
    },
    {
      path: `/causas/${CASE_MODELO.id}`,
      name: "case-hearings-add-to-calendar",
      themes: ["light"],
      prepare: agendaWeek(),
      act: async (page) => {
        const button = page.getByRole("button", { name: /^Agregá al calendario/ }).first();
        await button.waitFor();
        await button.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 300),
        );
      },
      fullPage: false,
    },
  ],
  t47: [
    {
      path: "/tareas",
      name: "tasks-mine",
      prepare: withTasks,
      act: (page) => page.getByRole("article").first().waitFor(),
    },
    {
      path: `/tareas?persona=${LAWYER_PAULA.id}&hechas=si`,
      name: "tasks-by-person",
      themes: ["light"],
      prepare: withTasks,
      act: (page) => page.getByRole("article").first().waitFor(),
    },
    {
      path: "/tareas",
      name: "tasks-empty",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: agendaWeek(),
      act: (page) => page.getByRole("heading", { name: "No tenés tareas pendientes" }).waitFor(),
    },
    {
      path: "/tareas",
      name: "tasks-quick-add",
      prepare: withTasks,
      act: async (page) => {
        await page.getByRole("article").first().waitFor();
        await page.getByRole("button", { name: "Nueva tarea" }).first().click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Qué hay que hacer").fill("Pedir el informe del registro");
        await dialog.getByLabel("Vence el").fill("2026-11-26");
      },
      fullPage: false,
    },
    {
      path: "/",
      name: "agenda-today-tasks",
      prepare: withTasks,
      act: waitForHearings,
    },
    {
      path: `/causas/${CASE_MODELO.id}`,
      name: "case-tasks",
      themes: ["light"],
      prepare: withTasks,
      act: async (page) => {
        const section = page.getByRole("region", { name: "Tareas" });
        await section.getByRole("article").first().waitFor();
        await section.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 80),
        );
      },
      fullPage: false,
    },
  ],
  t49: [
    {
      path: "/novedades",
      name: "news",
      prepare: withNews,
      act: (page) => page.getByRole("region", { name: "Hoy" }).waitFor(),
    },
    {
      path: "/novedades",
      name: "news-archived",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: withNews,
      act: async (page) => {
        await page.getByRole("button", { name: "Archivá la publicación de Paula Demo" }).click();
        const undo = page.getByRole("button", { name: "Deshacé" });
        await undo.waitFor();
        await undo.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 240),
        );
      },
      fullPage: false,
    },
    {
      path: "/novedades",
      name: "news-import",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: withNews,
      act: async (page) => {
        await page.getByRole("button", { name: "Mirá las 4 causas" }).click();
        const toggle = page.getByRole("button", { name: "Ocultá las causas" });
        await toggle.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 200),
        );
        await page.mouse.move(0, 0);
      },
      fullPage: false,
    },
    {
      path: "/novedades",
      name: "news-empty",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: agendaWeek(),
      act: (page) => page.getByRole("heading", { name: "Todavía no hay novedades" }).waitFor(),
    },
    {
      path: "/novedades",
      name: "news-error",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: async (page) => {
        await page.clock.setFixedTime(new Date(FIXTURE_NOW));
        await mockBackend(page, { signedIn: true, newsFails: true });
      },
      act: (page) => page.getByText("No pudimos cargar las novedades").waitFor({ timeout: 15_000 }),
    },
    {
      path: "/",
      name: "agenda-news",
      prepare: withNews,
      act: async (page) => {
        await waitForHearings(page);
        await page.getByRole("list", { name: "Últimas novedades" }).waitFor();
      },
    },
  ],
  t50: [
    {
      path: "/honorarios",
      name: "fees-result",
      prepare: withFees(),
      act: async (page) => {
        await page.getByLabel("Tipo de asunto").selectOption(MIN_EXCARCELACION.code);
        await page.getByLabel("Monto del proceso").fill("20000000");
        await page.getByRole("radio", { name: /Apoderado y patrocinante/ }).check();
        await page.getByRole("button", { name: "Calculá el honorario" }).click();
        await page.getByRole("region", { name: "Honorario estimado" }).waitFor();
        await page.mouse.move(0, 0);
      },
    },
    {
      path: "/honorarios",
      name: "fees-form",
      themes: ["light"],
      prepare: withFees(),
      act: (page) => page.getByLabel("Tipo de asunto").waitFor(),
    },
    {
      path: "/honorarios",
      name: "fees-no-jus",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: withFees({ jusValues: [], role: "PARALEGAL" }),
      act: async (page) => {
        const empty = page.getByRole("region", { name: "Cargá el valor del JUS" });
        await empty.waitFor();
        await empty.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 80),
        );
      },
      fullPage: false,
    },
    {
      path: "/ajustes/jus",
      name: "settings-jus",
      prepare: withFees(),
      act: (page) => page.getByRole("region", { name: "Historial" }).waitFor(),
    },
    {
      path: "/ajustes/jus",
      name: "settings-jus-archived",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: withFees(),
      act: async (page) => {
        await page.getByRole("button", { name: /^Archivá el valor de \$\s81\.250,00/ }).click();
        const undo = page.getByRole("button", { name: "Deshacé" });
        await undo.waitFor();
        await undo.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 300),
        );
      },
      fullPage: false,
    },
    {
      path: "/ajustes/jus",
      name: "settings-jus-read-only",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: withFees({ role: "PARALEGAL" }),
      act: (page) => page.getByRole("region", { name: "Historial" }).waitFor(),
    },
    {
      path: "/causas",
      name: "user-menu-fees",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: withFees(),
      act: async (page) => {
        await page.getByRole("button", { name: /Tu cuenta/ }).click();
        await page.getByRole("menu").waitFor();
      },
      fullPage: false,
    },
  ],
  t51: [
    {
      path: "/calculadora-de-plazos",
      name: "public-calculator-result",
      prepare: publicCalculator(),
      act: (page) =>
        calculatePublic(page, "impugnacion-ordinaria", "2026-11-20").then(() =>
          page.getByRole("region", { name: "Impugnación ordinaria: vence el" }).waitFor(),
        ),
    },
    {
      path: "/calculadora-de-plazos",
      name: "public-calculator-hours",
      themes: ["light"],
      prepare: publicCalculator(),
      act: async (page) => {
        await page.getByLabel("Plazo", { exact: true }).selectOption("control-judicial-detencion");
        await page.getByLabel("Hora de inicio").fill("10:30");
        await calculatePublic(page, "control-judicial-detencion", "2026-11-20");
        await page
          .getByRole("region", { name: "Detención sin control judicial: vence el" })
          .waitFor();
      },
    },
    {
      path: "/calculadora-de-plazos",
      name: "public-calculator-form",
      themes: ["light"],
      prepare: publicCalculator(),
      act: async (page) => {
        await page.getByLabel("Plazo", { exact: true }).selectOption("control-judicial-detencion");
        await page.getByLabel("Hora de inicio").waitFor();
      },
    },
    {
      path: "/calculadora-de-plazos",
      name: "public-calculator-calendar-missing",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: publicCalculator(),
      act: async (page) => {
        await calculatePublic(page, "impugnacion-ordinaria", "2027-12-28");
        await page.getByRole("heading", { name: /No se puede calcular/ }).waitFor();
      },
      fullPage: false,
    },
    {
      path: "/calculadora-de-plazos",
      name: "public-calculator-throttled",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: publicCalculator({ throttled: true }),
      act: async (page) => {
        await calculatePublic(page, "impugnacion-ordinaria", "2026-11-20");
        const alert = page.getByRole("alert");
        await alert.waitFor();
        await alert.evaluate((element) =>
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 360),
        );
      },
      fullPage: false,
    },
    {
      path: "/ingresar",
      name: "login-calculator-link",
      themes: ["light"],
      prepare: (page) => mockBackend(page),
      act: (page) => page.getByRole("link", { name: "calculadora de plazos gratuita" }).waitFor(),
    },
  ],
  t60: [
    {
      path: "/personas",
      name: "persons",
      prepare: withPersons,
      act: waitForArticleOrTable,
    },
    {
      path: `/personas/${PERSON_JULIAN.id}`,
      name: "person-client-detail",
      prepare: withPersons,
      act: (page) =>
        page
          .getByRole("region", { name: "Contactos autorizados" })
          .getByRole("article")
          .first()
          .waitFor(),
    },
    {
      path: "/personas",
      name: "person-new-conflict",
      themes: ["light", "dark"],
      prepare: withPersons,
      act: async (page) => {
        await page.getByRole("button", { name: "Nueva persona" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Apellidos").fill("Ficticio");
        await dialog.getByLabel("Nombres", { exact: true }).fill("Julián");
        await dialog.getByLabel("Número de documento").fill("99.000.111");
        await dialog.getByLabel("Número de documento").blur();
        const found = dialog.getByText("Ya hay 2 personas con este documento");
        await found.waitFor();
        await found.scrollIntoViewIfNeeded();
      },
      fullPage: false,
    },
    {
      path: "/personas",
      name: "person-conflict-check",
      themes: ["light"],
      prepare: withPersons,
      act: async (page) => {
        await page.getByRole("button", { name: "Control de conflicto" }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Número de documento").fill("30-99000333-1");
        await dialog.getByRole("button", { name: "Buscá el documento" }).click();
        await dialog.getByText("Ya hay 1 persona con este documento").waitFor();
      },
      fullPage: false,
    },
    {
      path: "/personas?q=inexistente",
      name: "persons-empty-search",
      viewports: ["mobile"],
      themes: ["light"],
      prepare: withPersons,
      act: (page) => page.getByRole("heading", { name: /No encontramos personas/ }).waitFor(),
    },
  ],
};

/** Signed in on 23 November 2026 with the fictitious persons and clients (T60). */
async function withPersons(page: Page) {
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, { signedIn: true, persons: ALL_PERSONS });
}

/** Anonymous, on 23 November 2026 (T51): the public calculator needs no session. */
function publicCalculator(extra: { throttled?: boolean } = {}) {
  return async (page: Page) => {
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, { publicThrottled: extra.throttled });
  };
}

async function calculatePublic(page: Page, rule: string, startDate: string) {
  await page.getByLabel("Plazo", { exact: true }).selectOption(rule);
  await page.getByLabel("Fecha de inicio").fill(startDate);
  await page.getByRole("button", { name: "Calculá el vencimiento" }).click();
  await page.mouse.move(0, 0);
}

/** Signed in on 23 November 2026 with the fictitious JUS values (T50). */
function withFees(extra: { jusValues?: JusValueView[]; role?: "OWNER" | "PARALEGAL" } = {}) {
  return async (page: Page) => {
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, {
      signedIn: true,
      today: "2026-11-23",
      jusValues: extra.jusValues ?? ALL_JUS_VALUES,
      role: extra.role,
    });
  };
}

async function chooseImportKind(page: Page, title: string) {
  await page.getByRole("radio", { name: new RegExp(`^${title}`) }).check();
  await page.getByRole("button", { name: "Continuá" }).click();
  await page.getByRole("heading", { name: /Subí la planilla/ }).waitFor();
  // Keep the pointer off the buttons that take the clicked one's place.
  await page.mouse.move(0, 0);
}

async function uploadImport(page: Page, name: string) {
  await page.getByLabel(/Elegí el archivo/).setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from("tipo_persona;nombres;apellidos\nhumana;Juan;Ejemplo\n"),
  });
}

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
