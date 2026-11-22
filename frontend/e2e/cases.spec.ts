/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import { CASE_EJEMPLAR, CASE_MODELO } from "../src/test/case-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

async function open(page: Page, path: string) {
  // Monday 23 November 2026, 10:20 in Neuquén: the fixtures' week.
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, { signedIn: true });
  await page.goto(path);
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("cases on a phone: cards, search in the URL, then a case with its detainee", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page, "/causas");

  await expect(page.getByRole("heading", { level: 1, name: "Causas" })).toBeVisible();
  await expect(page.getByText("4 causas en el estudio.")).toBeVisible();
  // Phones get cards; the table is for wide screens.
  await expect(page.getByRole("table")).toBeHidden();
  const modelo = page.getByRole("article", { name: CASE_MODELO.caption });
  await expect(modelo).toContainText("1 persona detenida");
  await expect(page.getByRole("article", { name: CASE_EJEMPLAR.caption })).toContainText(
    "Reservada",
  );
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  const box = await page.getByRole("searchbox", { name: "Buscá una causa" }).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);

  await page.getByRole("searchbox", { name: "Buscá una causa" }).fill("modelo");
  await expect(page).toHaveURL(/\/causas\?q=modelo$/);
  await expect(page.getByText("1 causa para «modelo».")).toBeVisible();

  // The whole card opens the case.
  await page
    .getByRole("article", { name: CASE_MODELO.caption })
    .click({ position: { x: 20, y: 120 } });
  await expect(page).toHaveURL(new RegExp(`/causas/${CASE_MODELO.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: CASE_MODELO.caption })).toBeVisible();
  await expect(page.getByRole("article", { name: "Carla Modelo" })).toContainText(
    "En prisión preventiva",
  );
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await page.goBack();
  await expect(page.getByRole("searchbox", { name: "Buscá una causa" })).toHaveValue("modelo");
});

test("cases on a desktop: the docket table and the detail in two columns", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "/causas");

  const table = page.getByRole("table", { name: "Causas, página 1 de 1" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(5);
  await expect(page.getByRole("list", { name: "Causas" })).toBeHidden();

  await page.getByRole("switch", { name: "Incluí las archivadas" }).click();
  await expect(page).toHaveURL(/archivadas=si/);
  await expect(table.getByRole("row")).toHaveCount(6);

  await table.getByRole("link", { name: CASE_EJEMPLAR.caption }).click();
  await expect(page.getByRole("heading", { level: 1, name: CASE_EJEMPLAR.caption })).toBeVisible();
  await expect(page.getByRole("article", { name: "Nora Ficticia" })).toContainText(
    "Prófugo o rebelde",
  );
  await expect(page.getByRole("region", { name: "Datos de la causa" })).toContainText("[validar]");
});

test("an unknown case says so and leads back to the list", async ({ page }) => {
  await open(page, "/causas/00000000-0000-4000-a000-999999999999");

  await expect(
    page.getByRole("heading", { level: 1, name: "No encontramos esta causa" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Volvé a las causas" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Causas" })).toBeVisible();
});
