/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { mockBackend } from "./mock-backend";

test("an anonymous visitor computes a deadline from the login, without signing in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const backend = await mockBackend(page);

  await page.goto("/ingresar");
  await page.getByRole("link", { name: "calculadora de plazos gratuita" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Calculadora de plazos del CPP de Neuquén" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/calculadora-de-plazos$/);
  await expect(page).toHaveTitle(/Calculadora de plazos/);

  await page.getByLabel("Plazo", { exact: true }).selectOption("impugnacion-ordinaria");
  await page.getByLabel("Fecha de inicio").fill("2026-11-20");
  await page.getByRole("button", { name: "Calculá el vencimiento" }).click();

  const result = page.getByRole("region", { name: "Impugnación ordinaria: vence el" });
  await expect(result.getByText("Lunes 30 de noviembre de 2026")).toBeVisible();
  await expect(result).toContainText("[validar]");
  await expect(result).toContainText("Cálculo asistido: verificá con la norma.");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // The page itself never asks for the session (the login before it did).
  const afterLogin = backend.calls.slice(backend.calls.indexOf("GET /api/v1/public/deadline-rules"));
  expect(afterLogin).not.toContain("GET /api/v1/me");

  await page.getByRole("link", { name: "Ingresá a tu estudio" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ingresá a tu estudio" })).toBeVisible();
});
