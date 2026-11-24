/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import { CASE_MODELO } from "../src/test/case-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

const NOTIFICATION = `OFICINA JUDICIAL - CIRCUNSCRIPCIÓN I (ficticia)
Se notifica que se fijó audiencia de control de acusación para el 02/12/2026 a las 10:15 hs,
en la Sala 4, con una duración estimada de 90 minutos. Legajo OFIJU-0000/2026 (ficticio).`;

/** Writes the screen to docs/screenshots/ai-assist/ when SCREENSHOTS is set; a no-op otherwise. */
const capture = (page: Page, name: string, fullPage = false) =>
  process.env.SCREENSHOTS
    ? page.screenshot({ path: `../docs/screenshots/ai-assist/${name}.png`, fullPage })
    : Promise.resolve();

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name}: the owner turns the AI on and a hearing is filled from a notification`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, { signedIn: true });

    await page.goto("/ajustes/ia");
    await expect(page.getByRole("heading", { level: 1, name: "Asistente de IA" })).toBeVisible();
    await expect(page.getByText("Solo con datos ficticios por ahora")).toBeVisible();
    await page.getByRole("switch", { name: "Activado en el estudio" }).click();
    await expect(page.getByText("Guardado: el asistente de IA está activado.")).toBeVisible();
    await capture(page, `settings-${viewport.name}`, viewport.name === "desktop");

    await page.goto("/");
    await page.getByRole("button", { name: "Cargá una audiencia" }).last().click();
    const dialog = page.getByRole("dialog", { name: "Nueva audiencia" });
    await dialog.getByLabel("Buscá la causa").fill("Modelo");
    await dialog.getByRole("radio", { name: new RegExp(CASE_MODELO.caption) }).click();

    await dialog.getByRole("button", { name: "Pegá una notificación" }).click();
    await dialog.getByLabel("Texto de la notificación").fill(NOTIFICATION);
    await dialog.getByRole("button", { name: "Completá con IA" }).click();

    await expect(
      dialog.getByText("Revisá cada dato antes de guardar: la IA puede equivocarse"),
    ).toBeVisible();
    await expect(dialog.getByLabel("Tipo de audiencia")).toHaveValue("control-de-acusacion");
    await expect(dialog.getByLabel("Día")).toHaveValue("2026-12-02");
    await expect(dialog.getByLabel("Hora")).toHaveValue("10:15");
    await expect(dialog.getByLabel("Sala")).toHaveValue("Sala 4 (ficticia)");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    await capture(page, `hearing-draft-${viewport.name}`);
  });
}
