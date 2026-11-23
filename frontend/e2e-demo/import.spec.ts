import { expect, test } from "@playwright/test";

import { horizontalOverflow, signIn } from "./api";
import { FIRM_TIME_ZONE, LUCIA } from "./demo-users";

test.use({ locale: "es-AR", timezoneId: FIRM_TIME_ZONE });

const HEADER = "tipo_persona;nombres;apellidos;telefono;domicilio";

/** Fictitious people without a document, so the import can run again on the same database. */
const csv = (name: string, rows: string[]) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from([HEADER, ...rows].join("\r\n") + "\r\n", "utf8"),
});

test("import a CSV of people: the check finds the error, the corrected file is saved", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, LUCIA);

  await page.goto("/importar");
  await expect(page.getByRole("heading", { level: 1, name: "Importar planillas" })).toBeVisible();
  await page.getByRole("radio", { name: /^Personas/ }).check();
  await page.getByRole("button", { name: "Continuá" }).click();
  await expect(page.getByRole("heading", { name: "Subí la planilla de personas" })).toBeFocused();

  // The second row lacks the surname a human person needs: nothing is saved.
  await page.getByLabel(/Elegí el archivo/).setInputFiles(
    csv("personas-con-errores.csv", [
      "humana;Ana;Prueba Importada;2990000001;Calle Ficticia 100, Neuquén",
      "humana;Bruno;;2990000002;Calle Ficticia 200, Neuquén",
    ]),
  );
  await expect(page.getByRole("heading", { name: "Hay 1 fila para corregir" })).toBeVisible();
  const report = page.getByRole("table", { name: "Qué corregir en cada fila" });
  await expect(report).toContainText("apellidos");
  await expect(report).toContainText("Una persona humana necesita apellidos.");
  await expect(page.getByRole("button", { name: /Confirmá/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Subí la planilla corregida" }).click();
  await page.getByLabel(/Elegí el archivo/).setInputFiles(
    csv("personas.csv", [
      "humana;Ana;Prueba Importada;2990000001;Calle Ficticia 100, Neuquén",
      "humana;Bruno;Ejemplo Importado;2990000002;Calle Ficticia 200, Neuquén",
    ]),
  );
  await expect(page.getByRole("heading", { name: "Revisá antes de guardar" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmá e importá 2 filas" }).click();

  await expect(page.getByRole("heading", { name: "Listo: importaste las personas" })).toBeVisible();
  await expect(page.getByText(/Se crearon 2 personas\./)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
