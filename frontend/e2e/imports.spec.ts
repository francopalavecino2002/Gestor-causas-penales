/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const csvFile = (name: string) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from("tipo_persona;nombres;apellidos\nhumana;Juan;Ejemplo\n"),
});

test("import on a phone: errors first, then the corrected file is confirmed", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  const backend = await mockBackend(page, { signedIn: true });
  await page.goto("/ajustes");

  await page.getByRole("link", { name: /Importar planillas/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Importar planillas" })).toBeVisible();
  const template = page.getByRole("link", { name: "Descargá la plantilla de personas" });
  expect((await template.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("radio", { name: /^Personas/ }).check();
  await page.getByRole("button", { name: "Continuá" }).click();
  await expect(page.getByRole("heading", { name: "Subí la planilla de personas" })).toBeFocused();

  await page.getByLabel(/Elegí el archivo/).setInputFiles(csvFile("personas-con-errores.csv"));
  await expect(page.getByRole("heading", { name: "Hay 2 filas para corregir" })).toBeVisible();
  const table = page.getByRole("table", { name: "Qué corregir en cada fila" });
  await expect(table).toContainText("numero_documento");
  await expect(table).toContainText("Una persona humana necesita apellidos.");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await expect(page.getByRole("button", { name: /Confirmá/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Subí la planilla corregida" }).click();
  await page.getByLabel(/Elegí el archivo/).setInputFiles(csvFile("personas.csv"));
  await page.getByRole("button", { name: "Confirmá e importá 4 filas" }).click();

  await expect(page.getByRole("heading", { name: "Listo: importaste las personas" })).toBeVisible();
  await expect(page.getByText(/Se crearon 4 personas\./)).toBeVisible();
  expect(backend.calls.filter((call) => call.startsWith("POST /api/v1/imports"))).toHaveLength(3);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("import on a desktop: cases go to the case list after confirming", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, { signedIn: true });
  await page.goto("/importar");

  const steps = page.getByRole("list", { name: "Pasos de la importación" });
  await expect(steps).toContainText("Qué importás");
  await page.getByRole("radio", { name: /^Causas/ }).check();
  await page.getByRole("button", { name: "Continuá" }).click();
  await page.getByLabel(/Elegí el archivo/).setInputFiles(csvFile("causas.csv"));

  await expect(
    page.getByText("Al confirmar se van a crear 2 causas, 3 imputados y 1 persona."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmá e importá 3 filas" }).click();
  await page.getByRole("link", { name: "Mirá las causas" }).click();
  await expect(page).toHaveURL(/\/causas$/);
});
