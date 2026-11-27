/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { DEMO_ME, mockBackend, RESET_TOKEN } from "./mock-backend";

const NEW_PASSWORD = "una frase larga ficticia";

test("asks for a reset link from the login and chooses a new password with it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const backend = await mockBackend(page);

  await page.goto("/ingresar");
  await page.getByLabel("Estudio").fill(DEMO_ME.tenant.slug);
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Recuperá tu contraseña" }),
  ).toBeVisible();
  await expect(page.getByLabel("Estudio")).toHaveValue(DEMO_ME.tenant.slug);
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.getByLabel("Email").fill(DEMO_ME.email);
  await page.getByRole("button", { name: "Enviame el enlace" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Revisá tu correo" })).toBeFocused();
  await expect(page.getByText("Vence en 30 minutos.", { exact: false })).toBeVisible();
  expect(backend.calls).toContain("POST /api/v1/auth/password-reset");

  // The emailed link: the token travels in the fragment and leaves the address bar on arrival.
  await page.goto(`/restablecer-clave?estudio=${DEMO_ME.tenant.slug}#token=${RESET_TOKEN}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Elegí una contraseña nueva" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/restablecer-clave\?estudio=estudio-demo$/);

  await page.getByLabel("Nueva contraseña", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Repetila", { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Guardá la contraseña nueva" }).click();

  await expect(page).toHaveURL(/\/ingresar\?estudio=estudio-demo&aviso=clave-restablecida$/);
  await expect(page.getByRole("status")).toHaveText(
    "Listo, ya podés ingresar con tu nueva contraseña.",
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a link without a valid token offers a new one", async ({ page }) => {
  await mockBackend(page);
  await page.goto(`/restablecer-clave?estudio=${DEMO_ME.tenant.slug}#token=vencido`);

  await expect(
    page.getByRole("heading", { level: 1, name: "El enlace no es válido o venció" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Pedí un enlace nuevo" }).click();
  await expect(page).toHaveURL(/\/recuperar-clave\?estudio=estudio-demo$/);
});
