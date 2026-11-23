import { expect, test } from "@playwright/test";

import { horizontalOverflow, signIn } from "./api";
import { FIRM_TIME_ZONE, LUCIA } from "./demo-users";

test.use({ locale: "es-AR", timezoneId: FIRM_TIME_ZONE });

/** Today in the firm's zone, `YYYY-MM-DD`: what the agenda opens on. */
function firmToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FIRM_TIME_ZONE }).format(new Date());
}

test("open a case with its defendant, add a hearing for today and find it in the agenda", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Unique per run: the suite shares one database and a second run must not hit the first's case.
  const stamp = Date.now().toString().slice(-7);
  const caption = `Prueba E2E ${stamp}, Lisandro s/ hurto (ficticio)`;
  const lastNames = `Prueba E2E ${stamp}`;
  await signIn(page, LUCIA);

  await page
    .getByRole("navigation", { name: "Secciones" })
    .getByRole("link", { name: "Causas" })
    .click();
  await page.getByRole("button", { name: "Nueva causa" }).click();
  const caseForm = page.getByRole("dialog", { name: "Nueva causa" });
  await caseForm.getByLabel("Carátula").fill(caption);
  await caseForm.getByLabel("Circunscripción").selectOption({ index: 1 });
  await caseForm.getByLabel("Número interno del estudio").fill(`E2E-${stamp}`);
  await caseForm.getByRole("checkbox", { name: "Agregá ahora al primer imputado" }).click();
  await caseForm.getByRole("radio", { name: "Es una persona nueva" }).check();
  await caseForm.getByLabel("Apellidos").fill(lastNames);
  await caseForm.getByLabel("Nombres").fill("Lisandro");
  await caseForm.getByRole("button", { name: "Guardá la causa" }).click();

  await expect(page).toHaveURL(/\/causas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: caption })).toBeVisible();
  const defendant = `${lastNames}, Lisandro`;
  await expect(page.getByRole("article", { name: defendant })).toBeVisible();

  await page.getByRole("button", { name: "Nueva audiencia" }).click();
  const hearingForm = page.getByRole("dialog", { name: "Nueva audiencia" });
  await hearingForm.getByLabel("Tipo de audiencia").selectOption("formulacion-de-cargos");
  await expect(hearingForm.getByText(/^CPP art\. /)).toBeVisible();
  await hearingForm.getByLabel("Día").fill(firmToday());
  await hearingForm.getByLabel("Hora").fill("23:30");
  await hearingForm.getByLabel("Sala").fill(`Sala E2E ${stamp}`);
  // The case's responsible (the creator) goes, and its only defendant is called.
  await expect(hearingForm.getByRole("checkbox", { name: /Lucía Ejemplo/ })).toBeChecked();
  await expect(hearingForm.getByRole("checkbox", { name: defendant })).toBeChecked();
  await hearingForm.getByRole("button", { name: "Guardá la audiencia" }).click();
  // A clash with a seeded hearing is a warning, not an error: acknowledge it if it shows.
  const saved = page.getByRole("dialog", { name: "La audiencia se guardó" });
  await expect(hearingForm).toBeHidden();
  if (await saved.isVisible()) await saved.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const hearings = page.getByRole("region", { name: "Audiencias", exact: true });
  await expect(hearings.getByRole("article", { name: "Formulación de cargos" })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Secciones" })
    .getByRole("link", { name: "Agenda" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Formulación de cargos" }).filter({ hasText: defendant }),
  ).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
