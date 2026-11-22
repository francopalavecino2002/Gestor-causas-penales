import { expect, test } from "@playwright/test";

import { mockBackend } from "./mock-backend";

test("home shows today's agenda in Spanish for a signed-in user", async ({ page }) => {
  await mockBackend(page, { signedIn: true });
  await page.goto("/");

  await expect(page).toHaveTitle("Gestor de causas penales");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
  await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
});

test("anonymous visitors land on the login", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");

  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ingresá a tu estudio" })).toBeVisible();
});

test("serves a Spanish web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Gestor de causas penales", lang: "es-AR" });
});
