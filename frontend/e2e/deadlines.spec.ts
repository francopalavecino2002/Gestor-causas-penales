/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import { CASE_EJEMPLO, CASE_MODELO } from "../src/test/case-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

async function open(page: Page, path: string, options: { deadlinesFail?: boolean } = {}) {
  // Monday 23 November 2026, 10:20 in Neuquén: the fixtures' week.
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, { signedIn: true, ...options });
  await page.goto(path);
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("deadlines on a phone: urgency groups, detainees first, horizon in the URL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page, "/");
  await page
    .getByRole("navigation", { name: "Secciones" })
    .getByRole("link", { name: "Plazos" })
    .click();

  await expect(page.getByRole("heading", { level: 1, name: "Plazos" })).toBeVisible();
  await expect(
    page.getByText("Tenés 6 plazos para atender en los próximos 30 días, 2 de personas detenidas."),
  ).toBeVisible();

  const dueSoon = page.getByRole("region", { name: /Vencen pronto/ });
  const first = dueSoon.getByRole("article").first();
  await expect(first).toContainText("Detención sin control judicial");
  await expect(first).toContainText("Persona detenida");
  await expect(first).toContainText("Quedan 15 horas");
  await expect(first).toContainText("Cálculo asistido: verificá con la norma.");
  await expect(first.getByRole("link", { name: CASE_EJEMPLO.caption })).toBeVisible();
  await expect(page.getByRole("region", { name: /Vencidos/ })).toContainText("Venció hace 3 días");
  await expect(page.getByRole("region", { name: /Sin calcular/ })).toContainText(
    "el calendario judicial de 2026",
  );
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  const seven = page
    .getByRole("group", { name: "Horizonte" })
    .getByRole("button", { name: "7 días" });
  expect((await seven.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await seven.click();
  await expect(page).toHaveURL(/\/plazos\?dias=7$/);
  await expect(page.getByText(/Tenés 5 plazos para atender en los próximos 7 días/)).toBeVisible();

  await page.getByRole("switch", { name: "Solo personas detenidas" }).click();
  await expect(page).toHaveURL(/detenidos=si/);
  await expect(page.getByRole("article")).toHaveCount(2);

  await page
    .getByRole("article", { name: "Audiencia de revisión de prisión preventiva" })
    .getByRole("link", { name: CASE_MODELO.caption })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: CASE_MODELO.caption })).toBeVisible();
  const caseDeadlines = page.getByRole("region", { name: "Plazos", exact: true });
  await expect(caseDeadlines.getByRole("region", { name: /Cumplidos/ })).toContainText(
    "Formulación de cargos con detenido",
  );
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("deadlines on a desktop: two columns of cards and the error state", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "/plazos?dias=60");

  await expect(
    page.getByRole("group", { name: "Horizonte" }).getByRole("button", { name: "60 días" }),
  ).toHaveAttribute("aria-pressed", "true");
  const cards = page.getByRole("region", { name: /Vencen pronto/ }).getByRole("article");
  await expect(cards).toHaveCount(3);
  const [a, b] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
  // Side by side from 1280 px.
  expect(a?.y).toBe(b?.y);
  expect((b?.x ?? 0) > (a?.x ?? 0)).toBe(true);

  await open(page, "/plazos", { deadlinesFail: true });
  await expect(page.getByRole("alert")).toContainText("No pudimos cargar los plazos", {
    timeout: 15_000,
  });
});
