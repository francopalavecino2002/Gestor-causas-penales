/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { FIXTURE_NOW, WEEK_HEARINGS } from "../src/test/agenda-fixtures";
import { ALL_DUE_SOON, ALL_NEWS, DUE_SOON_CONTROL } from "../src/test/news-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

for (const viewport of [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name}: a lawyer reads the wall, posts and archives with undo`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, {
      signedIn: true,
      hearings: WEEK_HEARINGS,
      news: ALL_NEWS,
      dueSoon: ALL_DUE_SOON,
    });

    await page.goto("/");
    const card = page.getByRole("region", { name: "Novedades" });
    await expect(card.getByText("2 plazos vencen pronto.")).toBeVisible();
    await card.getByRole("link", { name: "Mirá todas las novedades" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Novedades" })).toBeVisible();
    const dueSoon = page.getByRole("region", { name: "Vencen pronto" });
    const control = dueSoon.getByRole("article", { name: DUE_SOON_CONTROL.ruleName });
    await expect(control.getByText("Persona detenida")).toBeVisible();
    await expect(control.getByText(DUE_SOON_CONTROL.source)).toBeVisible();
    await expect(dueSoon.getByText("Cálculo asistido: verificá con la norma.")).toBeVisible();

    await page.getByLabel("Contale algo al estudio").fill("El viernes cerramos a las 13.");
    await page.getByRole("button", { name: "Publicá" }).click();
    const today = page.getByRole("region", { name: "Hoy" });
    await expect(today.getByText("El viernes cerramos a las 13.")).toBeVisible();

    await page.getByRole("button", { name: "Archivá la publicación de Paula Demo" }).click();
    await expect(page.getByText("Archivaste esta publicación.")).toBeVisible();
    await page.getByRole("button", { name: "Deshacé" }).click();
    await expect(today.getByText(/nos juntamos para repartir/)).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}
