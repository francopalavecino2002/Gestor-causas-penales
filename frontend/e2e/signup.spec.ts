/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { DEMO_ME, mockBackend, SIGNED_UP, VERIFY_TOKEN } from "./mock-backend";

const PASSWORD = "una frase larga ficticia";

test("a new firm signs up from the login and confirms the email with the link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const backend = await mockBackend(page, { signup: true });

  await page.goto("/ingresar");
  await page.getByRole("link", { name: "Probá gratis" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Probá gratis 30 días" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Penal" })).toBeChecked();
  await page.getByLabel("Nombre del estudio").fill(SIGNED_UP.firmName);
  await page.getByLabel("Tu nombre").fill("Lucía Ficticia");
  await page.getByLabel("Email", { exact: true }).fill(SIGNED_UP.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Repetí la contraseña", { exact: true }).fill(PASSWORD);
  // The honeypot is out of the tab order: the last password is followed by the button.
  await page.getByLabel("Repetí la contraseña", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Mostrar la contraseña repetida" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Crear mi estudio" })).toBeFocused();

  const signup = page.waitForRequest("**/api/v1/auth/signup");
  await page.getByRole("button", { name: "Crear mi estudio" }).click();
  expect((await signup).postDataJSON()).toMatchObject({ practiceAreas: ["penal"], website: "" });

  await expect(page.getByRole("heading", { level: 1, name: "Revisá tu email" })).toBeFocused();
  await expect(page.getByText(SIGNED_UP.tenant, { exact: true })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // The emailed link: the token travels in the fragment and leaves the address bar on arrival.
  await page.goto(`/verificar-email?estudio=${SIGNED_UP.tenant}#token=${VERIFY_TOKEN}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "¡Listo! Ya confirmaste tu email." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/verificar-email\?estudio=estudio-ficticio-robles$/);
  expect(backend.calls.filter((call) => call === "POST /api/v1/auth/email-verification")).toHaveLength(
    1,
  );

  await page.getByRole("link", { name: "Ingresá a tu estudio" }).click();
  await expect(page).toHaveURL(/\/ingresar\?estudio=estudio-ficticio-robles$/);
  await expect(page.getByLabel("Estudio", { exact: true })).toHaveValue(SIGNED_UP.tenant);
});

test("the login says the email is not confirmed yet", async ({ page }) => {
  await mockBackend(page, { emailNotVerified: true });
  await page.goto(`/ingresar?estudio=${DEMO_ME.tenant.slug}`);

  await expect(page.getByRole("link", { name: "Probá gratis" })).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(DEMO_ME.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresá" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Todavía no confirmaste tu email. Te mandamos un enlace nuevo: abrilo y volvé a ingresar.",
  );
});

test("a link without a valid token sends to the login", async ({ page }) => {
  await mockBackend(page);
  await page.goto(`/verificar-email?estudio=${SIGNED_UP.tenant}#token=${"x".repeat(43)}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "El enlace no es válido o ya venció" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir a ingresar" }).click();
  await expect(page).toHaveURL(/\/ingresar\?estudio=estudio-ficticio-robles$/);
});

test("sign-up off shows that it is not available", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/registro");

  await expect(
    page.getByRole("heading", { level: 1, name: "El registro no está disponible por ahora" }),
  ).toBeVisible();
});
