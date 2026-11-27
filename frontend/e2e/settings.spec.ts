/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

async function open(page: Page, path: string) {
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, { signedIn: true });
  await page.goto(path);
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("settings on a phone: index, catalogs and a custom field", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page, "/ajustes");

  await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
  await expect(page.getByText("Plantillas por tipo de causa")).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("link", { name: /Catálogos/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Catálogos" })).toBeVisible();
  const hearing = page.getByRole("listitem", { name: "Formulación de cargos" });
  await expect(hearing).toContainText("CPP art. 133");
  const hide = hearing.getByRole("button", { name: "Ocultá" });
  expect((await hide.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await hide.click();
  await expect(page.getByRole("status")).toHaveText("Oculto: Formulación de cargos.");
  await expect(hearing.getByText("Oculto", { exact: true })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByLabel("Catálogo").selectOption("stages");
  await expect(page).toHaveURL(/catalogo=stages/);
  await expect(page.getByRole("heading", { level: 2, name: "Etapas del proceso" })).toBeVisible();

  await page.getByRole("link", { name: "Ajustes" }).click();
  await page.getByRole("link", { name: /Campos propios/ }).click();
  await page.getByRole("button", { name: "Agregá un campo" }).click();
  const dialog = page.getByRole("dialog", { name: "Agregá un campo a las causas" });
  await dialog.getByLabel("Nombre del campo").fill("Fiscalía interviniente");
  await dialog.getByText("Lista de opciones").click();
  await dialog.getByRole("textbox", { name: "Opción 1" }).fill("Fiscalía 1 (ficticia)");
  await dialog.getByRole("button", { name: "Agregá el campo" }).click();
  await expect(page.getByRole("status")).toHaveText("Agregado: Fiscalía interviniente.");
  await expect(page.getByRole("listitem", { name: "Fiscalía interviniente" })).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("settings on a desktop: deadline rules and users", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "/ajustes/plazos");

  const sections = page.getByRole("navigation", { name: "Secciones de ajustes" });
  await expect(sections.getByRole("link", { name: "Reglas de plazos" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const review = page.getByRole("article", { name: "Audiencia de revisión de prisión preventiva" });
  await expect(review).toContainText("Art. 118 · CPP de Neuquén (Ley 2784)");
  await expect(review).toContainText("Cálculo asistido: verificá con la norma.");

  await review.getByRole("switch", { name: "Activa en el estudio" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desactivá la regla" }).click();
  await expect(review.getByRole("status")).toHaveText("Guardado: la regla está desactivada.");
  await expect(review).toContainText("Desactivada en el estudio");

  await sections.getByRole("link", { name: "Usuarios y roles" }).click();
  const account = page.getByRole("region", { name: "Tu cuenta" });
  await expect(account).toContainText("Lucía Ejemplo");
  await expect(account).toContainText("Titular");
  // The owner manages the firm's people here (T62).
  const people = page.getByRole("region", { name: "Personas del estudio" });
  await expect(people.getByRole("table", { name: "Personas del estudio" })).toBeVisible();
  await expect(people.getByRole("button", { name: "Sumá una persona" })).toBeVisible();
});
