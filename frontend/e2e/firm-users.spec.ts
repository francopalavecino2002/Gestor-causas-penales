/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import { TEMPORARY_PASSWORDS } from "../src/test/firm-user-fixtures";
import { DEMO_ME, mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const viewport of [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name}: the owner adds a person and sees the temporary password once`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const { calls } = await mockBackend(page, { signedIn: true });

    await page.goto("/ajustes/usuarios");
    const section = page.getByRole("region", { name: "Personas del estudio" });
    await expect(section.getByText("Paula Demo", { exact: true })).toBeVisible();
    // Phones get cards, desktops the table.
    await expect(section.getByRole(viewport.name === "phone" ? "list" : "table")).toBeVisible();
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);

    await section.getByRole("button", { name: "Sumá una persona" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre y apellido").fill("Rocío Ficticia");
    await dialog.getByLabel("Email").fill("rocio.ficticia@ejemplo.test");
    await dialog.getByLabel("Rol").selectOption("PARALEGAL");
    await expect(dialog.getByText("Qué puede hacer el rol Procurador/a")).toBeVisible();
    await dialog.getByRole("button", { name: "Creá la cuenta" }).click();

    await expect(dialog.getByText(TEMPORARY_PASSWORDS[0]!)).toBeVisible();
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("alert")).toContainText("Antes de cerrar");
    await dialog.getByRole("checkbox", { name: "Ya la anoté" }).check();
    await dialog.getByRole("button", { name: "Listo" }).click();
    await expect(dialog).toBeHidden();

    await expect(section.getByText("Rocío Ficticia", { exact: true })).toBeVisible();
    await expect(section.getByText(TEMPORARY_PASSWORDS[0]!)).toHaveCount(0);
    expect(calls).toContain("POST /api/v1/firm/users");
  });
}

test("desktop: the owner changes a role from the row's options menu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { calls } = await mockBackend(page, { signedIn: true });
  await page.goto("/ajustes/usuarios");
  const table = page.getByRole("table", { name: "Personas del estudio" });
  const row = table.getByRole("row", { name: /Paula Demo/ });
  await row.getByRole("button", { name: "Opciones" }).click();
  await page.getByRole("menuitem", { name: "Cambiá el rol" }).click();

  const dialog = page.getByRole("dialog", { name: "Cambiá el rol de Paula Demo" });
  await dialog.getByLabel("Rol nuevo").selectOption("PARALEGAL");
  await dialog.getByRole("button", { name: "Guardá el rol" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Listo: Paula Demo ahora tiene el rol Procurador\/a/)).toBeVisible();
  await expect(row).toContainText("Procurador/a");
  // The menu and the dialog leave the page usable.
  await row.getByRole("button", { name: "Opciones" }).click();
  await expect(page.getByRole("menuitem", { name: "Archivá la cuenta" })).toBeVisible();
  expect(calls).toContain("PUT /api/v1/firm/users/00000000-0000-4000-8000-000000000002/role");
});

test("a person with a temporary password chooses their own, then signs in again", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { calls } = await mockBackend(page, { signedIn: true, passwordChangeRequired: true });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Elegí tu contraseña" })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);

  await page.getByLabel("Contraseña temporal", { exact: true }).fill("una-clave-ficticia");
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("mi frase nueva ficticia");
  await page
    .getByLabel("Repetí la contraseña nueva", { exact: true })
    .fill("mi frase nueva ficticia");
  await page.getByRole("button", { name: "Guardá tu contraseña" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Ingresá a tu estudio" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Listo. Ingresá con tu contraseña nueva.");
  await expect(page.getByLabel("Estudio", { exact: true })).toHaveValue(DEMO_ME.tenant.slug);

  await page.getByLabel("Email", { exact: true }).fill(DEMO_ME.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("mi frase nueva ficticia");
  await page.getByRole("button", { name: "Ingresá" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
  expect(calls).toContain("POST /api/v1/me/password");
});
