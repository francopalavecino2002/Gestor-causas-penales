/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

import {
  DETAINEE_ALERTS,
  FIXTURE_NOW,
  LAWYER_PAULA,
  WEEK_HEARINGS,
} from "../src/test/agenda-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

async function openAgenda(page: Page, path = "/") {
  // Monday 23 November 2026, 10:20 in Neuquén: the fixtures' week.
  await page.clock.setFixedTime(new Date(FIXTURE_NOW));
  await mockBackend(page, {
    signedIn: true,
    hearings: WEEK_HEARINGS,
    detaineeAlerts: DETAINEE_ALERTS,
  });
  await page.goto(path);
}

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("today's agenda on a phone: alerts first, the rail, then the week and a lawyer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await openAgenda(page);

  await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
  await expect(page.getByText("Hoy tenés 5 audiencias, 2 con personas detenidas.")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "2 avisos sobre personas detenidas" }),
  ).toBeVisible();
  await expect(page.getByTestId("now-line")).toHaveAccessibleName("Ahora son las 10:20");

  const review = page.getByRole("article", { name: "Revisión de prisión preventiva" });
  await expect(review).toContainText("CPP art. 118");
  await expect(review).toContainText("Persona detenida");
  await expect(review).toContainText("Superposición de horario");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  // Touch targets of the toolbar keep 44 px.
  for (const name of ["Día", "Semana", "Día anterior", "Hoy", "Día siguiente"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page).toHaveURL(/\?vista=semana$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Audiencias de esta semana" }),
  ).toBeVisible();
  // Seven days, plus the "Tareas de hoy" card.
  await expect(page.getByRole("heading", { level: 2, name: /Ver el día$/ })).toHaveCount(7);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  // The day header sticks under the top bar while its hearings scroll by.
  const monday = page.getByRole("region", { name: /Lunes 23 de noviembre/ });
  const mondayTop = await monday.evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY,
  );
  await page.evaluate((y) => window.scrollTo(0, y), mondayTop + 300);
  const header = monday.locator("header");
  await expect.poll(async () => (await header.boundingBox())?.y).toBeCloseTo(60, 0);

  await page.getByLabel("Abogado o abogada").selectOption({ label: "Paula Demo" });
  await expect(page).toHaveURL(new RegExp(`abogado=${LAWYER_PAULA.id}`));
  await expect(
    page.getByText("Paula Demo tiene 2 audiencias esta semana, 1 con una persona detenida."),
  ).toBeVisible();
});

test("the week view on a desktop, linkable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openAgenda(page, "/?vista=semana&fecha=2026-11-25");

  await expect(
    page.getByRole("heading", { level: 1, name: "Audiencias de esta semana" }),
  ).toBeVisible();
  await expect(page.getByText("Del 23 al 29 de noviembre")).toBeVisible();
  await expect(page.getByRole("button", { name: "Semana", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("region", { name: /Jueves 26 de noviembre/ })).toContainText(
    "Sin audiencias",
  );

  await page.getByRole("link", { name: /Martes 24 de noviembre/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Audiencias de mañana" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Control de la investigación" })).toBeVisible();

  await page.goBack();
  await expect(
    page.getByRole("heading", { level: 1, name: "Audiencias de esta semana" }),
  ).toBeVisible();
});
