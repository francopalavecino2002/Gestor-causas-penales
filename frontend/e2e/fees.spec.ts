/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { FIXTURE_NOW } from "../src/test/agenda-fixtures";
import { MIN_EXCARCELACION } from "../src/test/fee-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

for (const viewport of [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name}: a lawyer loads the JUS value and estimates a fee`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, { signedIn: true, role: "LAWYER", jusValues: [], today: "2026-11-23" });

    await page.goto("/");
    if (viewport.name === "phone") {
      // Not in the bottom nav: the phone reaches it from the account menu.
      await page.getByRole("button", { name: /Tu cuenta/ }).click();
      await page.getByRole("menuitem", { name: "Honorarios" }).click();
    } else {
      await page
        .getByRole("navigation", { name: "Secciones" })
        .getByRole("link", { name: "Honorarios" })
        .first()
        .click();
    }

    await expect(page.getByRole("heading", { level: 1, name: "Honorarios" })).toBeVisible();
    const empty = page.getByRole("region", { name: "Cargá el valor del JUS" });
    await empty.getByRole("link", { name: "Cargá el valor del JUS" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Valor del JUS" })).toBeVisible();
    await page.getByLabel("Valor del JUS").fill("94963,25");
    await page.getByLabel("Vigente desde").fill("2026-07-01");
    await page.getByRole("button", { name: "Guardá el valor" }).click();
    await expect(
      page.getByText("Guardado: el JUS de $ 94.963,25, vigente desde el 01/07/2026."),
    ).toBeVisible();

    await page.goto("/honorarios");
    await page.getByLabel("Tipo de asunto").selectOption(MIN_EXCARCELACION.code);
    await page.getByRole("button", { name: "Calculá el honorario" }).click();

    const result = page.getByRole("region", { name: "Honorario estimado" });
    await expect(result.getByText("$ 949.632,50").first()).toBeVisible();
    await expect(result.getByText("JUS de $ 94.963,25, vigente desde el 01/07/2026.")).toBeVisible();
    await expect(result.getByText("Cálculo asistido: verificá con la norma.")).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
}
