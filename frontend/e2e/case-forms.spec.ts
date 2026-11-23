/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const CAPTION = "Prueba, Lisandro s/ hurto (ficticio)";

for (const viewport of [
  { name: "phone", width: 360, height: 780 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`${viewport.name}: create a case with its defendant, add a hearing for today and find it in the agenda`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Monday 23 November 2026, 10:20 in Neuquén.
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, { signedIn: true });
    await page.goto("/causas");

    await page.getByRole("button", { name: "Nueva causa" }).click();
    const caseForm = page.getByRole("dialog", { name: "Nueva causa" });
    await expect(caseForm).toBeVisible();
    if (viewport.name === "phone") {
      // A full-height sheet on phones.
      const box = await caseForm.boundingBox();
      expect(box?.height).toBeCloseTo(viewport.height, 0);
      expect(box?.width).toBeCloseTo(viewport.width, 0);
    }
    await caseForm.getByLabel("Carátula").fill(CAPTION);
    await caseForm.getByLabel("Circunscripción").selectOption("confluencia");
    await caseForm.getByLabel("Legajo del MPF").fill("MPFNQ 4321/2026");
    await caseForm.getByRole("checkbox", { name: "Agregá ahora al primer imputado" }).click();
    await caseForm.getByRole("radio", { name: "Es una persona nueva" }).check();
    await caseForm.getByLabel("Apellidos").fill("Prueba");
    await caseForm.getByLabel("Nombres").fill("Lisandro");
    const save = caseForm.getByRole("button", { name: "Guardá la causa" });
    expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await save.click();

    await expect(page.getByRole("heading", { level: 1, name: CAPTION })).toBeVisible();
    await expect(page.getByRole("article", { name: "Prueba, Lisandro" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Nueva audiencia" }).click();
    const hearingForm = page.getByRole("dialog", { name: "Nueva audiencia" });
    await hearingForm.getByLabel("Tipo de audiencia").selectOption("formulacion-de-cargos");
    await expect(hearingForm.getByText("CPP art. 133", { exact: true })).toBeVisible();
    await hearingForm.getByLabel("Día").fill("2026-11-23");
    await hearingForm.getByLabel("Hora").fill("12:30");
    await hearingForm.getByLabel("Sala").fill("Sala 4 (ficticia)");
    await expect(hearingForm.getByRole("checkbox", { name: /Lucía Ejemplo/ })).toBeChecked();
    await expect(hearingForm.getByRole("checkbox", { name: "Prueba, Lisandro" })).toBeChecked();
    await hearingForm.getByRole("button", { name: "Guardá la audiencia" }).click();
    await expect(hearingForm).toBeHidden();

    const hearings = page.getByRole("region", { name: "Audiencias", exact: true });
    await expect(hearings.getByRole("article", { name: "Formulación de cargos" })).toContainText(
      "Sala 4 (ficticia)",
    );

    await page
      .getByRole("navigation", { name: "Secciones" })
      .getByRole("link", { name: "Agenda" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
    const card = page.getByRole("article", { name: "Formulación de cargos" });
    await expect(card).toContainText(CAPTION);
    await expect(card).toContainText("Sala 4 (ficticia)");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
}

test("the agenda's floating button opens the form, and it closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, { signedIn: true });
  await page.goto("/");

  const fab = page.getByRole("button", { name: "Cargá una audiencia" }).last();
  await expect(fab).toBeVisible();
  await fab.click();
  const dialog = page.getByRole("dialog", { name: "Nueva audiencia" });
  await expect(dialog.getByLabel("Buscá la causa")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(fab).toBeFocused();
});
