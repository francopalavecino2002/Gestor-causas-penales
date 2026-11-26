/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import {
  ALL_PERSONS,
  CONFLICT_DISCLAIMER,
  CONTACT_LAURA,
  PERSON_JULIAN,
} from "../src/test/person-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

for (const viewport of [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name}: a lawyer finds a client, checks a document and adds a contact`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, { signedIn: true, persons: ALL_PERSONS });

    await page.goto("/personas");
    await expect(page.getByRole("heading", { level: 1, name: "Personas" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscá por nombre o documento" }).fill("julián");
    await expect(page.getByText("2 personas para «julián».")).toBeVisible();
    await expect(page).toHaveURL(/q=juli/);

    // The conflict check: the number never lands in the URL.
    await page.getByRole("button", { name: "Control de conflicto" }).click();
    const check = page.getByRole("dialog", { name: "Control de conflicto" });
    await check.getByLabel("Número de documento").fill("99.000.111");
    await check.getByRole("button", { name: "Buscá el documento" }).click();
    await expect(check.getByText("Ya hay 2 personas con este documento")).toBeVisible();
    await expect(check.getByText(CONFLICT_DISCLAIMER)).toBeVisible();
    expect(page.url()).not.toContain("99000111");
    await check.getByRole("link", { name: PERSON_JULIAN.displayName, exact: true }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: PERSON_JULIAN.displayName }),
    ).toBeVisible();
    const cases = page.getByRole("region", { name: "Causas y roles" });
    await expect(cases.getByText("Causa reservada")).toBeVisible();
    const contacts = page.getByRole("region", { name: "Contactos autorizados" });
    await expect(contacts.getByRole("article", { name: CONTACT_LAURA.fullName })).toBeVisible();

    await page.getByRole("button", { name: "Agregá un contacto" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo contacto autorizado" });
    await dialog.getByLabel("Nombre y apellido").fill("Rosa Inventada");
    await dialog.getByLabel("Qué se le puede informar").fill("Fechas de audiencias.");
    await dialog.getByRole("button", { name: "Guardá el contacto" }).click();
    await expect(contacts.getByRole("article", { name: "Rosa Inventada" })).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}
