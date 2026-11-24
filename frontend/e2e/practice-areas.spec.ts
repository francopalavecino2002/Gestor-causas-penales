/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const CAPTION = "Muestra, Ana c/ Demo, Ramiro s/ daños (ficticio)";

for (const viewport of [
  { name: "phone", width: 360, height: 780 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`${viewport.name}: create a civil case with its actor and demandado, add a hearing and find it in the agenda by area`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, { signedIn: true, areas: ["penal", "civil"] });
    await page.goto("/causas");

    await page.getByRole("button", { name: "Nueva causa" }).click();
    const caseForm = page.getByRole("dialog", { name: "Nueva causa" });
    await caseForm
      .getByRole("group", { name: "¿De qué fuero es la causa?" })
      .getByRole("radio", { name: /Civil y comercial/ })
      .check();
    await expect(caseForm.getByLabel("Tipo de proceso")).toHaveValue("ordinario");
    await expect(caseForm.getByLabel("Legajo del MPF")).toHaveCount(0);
    await caseForm.getByLabel("Carátula").fill(CAPTION);
    await caseForm.getByLabel("Circunscripción").selectOption("confluencia");
    await caseForm.getByLabel("Etapa", { exact: true }).selectOption("inicio");
    await caseForm.getByRole("checkbox", { name: "Agregá ahora a la primera parte" }).click();
    await caseForm.getByRole("radio", { name: "Es una persona nueva" }).check();
    await caseForm.getByLabel("Apellidos").fill("Muestra");
    await caseForm.getByLabel("Nombres").fill("Ana");
    await expect(caseForm.getByLabel("Rol en la causa")).toHaveValue("actor");
    await caseForm.getByRole("button", { name: "Guardá la causa" }).click();

    await expect(page.getByRole("heading", { level: 1, name: CAPTION })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Fuero: Civil y comercial");
    await expect(page.getByRole("region", { name: "Imputados" })).toHaveCount(0);
    const parties = page.getByRole("region", { name: "Partes", exact: true });
    await expect(parties).toContainText("Muestra, Ana");
    await expect(parties).toContainText("Actor");

    await parties.getByRole("button", { name: "Agregá una parte" }).click();
    const partyForm = page.getByRole("dialog", { name: "Agregá una parte" });
    await partyForm.getByLabel("Rol en la causa").selectOption("demandado");
    await partyForm.getByRole("radio", { name: "Es una persona nueva" }).check();
    await partyForm.getByLabel("Apellidos").fill("Demo");
    await partyForm.getByLabel("Nombres").fill("Ramiro");
    await partyForm.getByRole("button", { name: "Agregá la parte" }).click();
    await expect(partyForm).toBeHidden();
    await expect(parties).toContainText("Demo, Ramiro");
    await expect(parties).toContainText("Demandado");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Nueva audiencia" }).click();
    const hearingForm = page.getByRole("dialog", { name: "Nueva audiencia" });
    await hearingForm.getByLabel("Tipo de audiencia").selectOption("preliminar");
    await expect(hearingForm.getByRole("group", { name: "Imputados citados" })).toHaveCount(0);
    await hearingForm.getByLabel("Día").fill("2026-11-23");
    await hearingForm.getByLabel("Hora").fill("12:30");
    await hearingForm.getByLabel("Sala").fill("Sala civil 2 (ficticia)");
    await hearingForm.getByRole("button", { name: "Guardá la audiencia" }).click();
    await expect(hearingForm).toBeHidden();

    await page
      .getByRole("navigation", { name: "Secciones" })
      .getByRole("link", { name: "Agenda" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
    await page.getByLabel("Fuero").selectOption("civil");
    const card = page.getByRole("article", { name: "Audiencia preliminar" });
    await expect(card).toContainText(CAPTION);
    await expect(card).toContainText("Civil y comercial");
    await expect(page.getByRole("article", { name: "Formulación de cargos" })).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
}

test("the owner turns an area on in Ajustes and it shows up in Nueva causa", async ({ page }) => {
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, { signedIn: true });
  await page.goto("/ajustes/fueros");

  await expect(page.getByRole("heading", { level: 1, name: "Fueros" })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Penal/ })).toBeDisabled();
  await page.getByRole("switch", { name: /Laboral/ }).click();
  await expect(page.getByRole("status")).toContainText("Habilitado: Laboral.");

  await page.goto("/causas");
  await page.getByRole("button", { name: "Nueva causa" }).click();
  await expect(
    page.getByRole("dialog", { name: "Nueva causa" }).getByRole("radio", { name: /Laboral/ }),
  ).toBeVisible();
});
