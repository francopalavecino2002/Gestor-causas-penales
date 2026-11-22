/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { DEMO_ME, mockBackend, TOTP_CODE } from "./mock-backend";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`login with two-step verification, navigate and sign out (${viewport.name})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const backend = await mockBackend(page, { secondFactor: true });

    await page.goto("/causas");
    await expect(page).toHaveURL(/\/ingresar\?redirect=%2Fcausas$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ingresá a tu estudio" }),
    ).toBeVisible();

    await page.getByLabel("Estudio").fill(DEMO_ME.tenant.slug);
    await page.getByLabel("Email").fill(DEMO_ME.email);
    await page.getByLabel("Contraseña", { exact: true }).fill("una-clave-ficticia");
    await page.getByRole("button", { name: "Ingresá" }).click();

    const code = page.getByLabel("Código de verificación");
    await expect(code).toBeFocused();
    await code.fill("111111");
    await page.getByRole("button", { name: "Verificá el código" }).click();
    await expect(page.getByRole("alert")).toContainText("El código no es válido");

    await page.getByLabel("Código de verificación").fill(TOTP_CODE);
    await page.getByRole("button", { name: "Verificá el código" }).click();

    // Back to the page that was asked for, inside the shell.
    await expect(page.getByRole("heading", { level: 1, name: "Causas" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Secciones" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Causas" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Plazos" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Plazos" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Plazos" })).toHaveAttribute("aria-current", "page");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: /Tu cuenta: Lucía Ejemplo, Titular/ }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Ingresá a tu estudio" }),
    ).toBeVisible();
    expect(backend.calls).toContain("POST /api/v1/auth/logout");

    // The firm is remembered on this device and offered on the next login.
    await expect(page.getByRole("button", { name: /Estudio Demo \(ficticio\)/ })).toBeVisible();
  });
}

test("shows the bottom nav on phones and the sidebar on desktops", async ({ page }) => {
  await mockBackend(page, { signedIn: true });

  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
  const bottomNav = page.locator("nav.fixed");
  await expect(bottomNav).toBeVisible();
  const box = await bottomNav.getByRole("link", { name: "Agenda" }).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(bottomNav).toBeHidden();
  await expect(page.getByRole("complementary").getByRole("link", { name: "Agenda" })).toBeVisible();
});

test("the skip link moves the focus to the content", async ({ page }) => {
  await mockBackend(page, { signedIn: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenido")).toBeFocused();
});
