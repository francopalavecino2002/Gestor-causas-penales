/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { FIXTURE_NOW, WEEK_HEARINGS } from "../src/test/agenda-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

for (const viewport of [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name}: a member creates a calendar link and downloads one hearing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.clock.setFixedTime(new Date(FIXTURE_NOW));
    await mockBackend(page, { signedIn: true, role: "LAWYER", hearings: WEEK_HEARINGS });

    await page.goto("/ajustes/calendario");
    await expect(page.getByRole("heading", { level: 1, name: "Tu calendario" })).toBeVisible();
    await page.getByRole("button", { name: "Creá tu enlace" }).click();

    const link = page.getByLabel("Tu enlace privado");
    await expect(link).toHaveValue(/\/api\/v1\/calendar-feed\/e2e-secreto-ficticio-1\.ics$/);
    await expect(page.getByText("Guardalo ahora: se muestra una sola vez")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrí en tu calendario" })).toHaveAttribute(
      "href",
      /^webcal:\/\//,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);

    await page.goto("/");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", {
          name: "Agregá al calendario la audiencia Revisión de prisión preventiva",
        })
        .click(),
    ]);
    expect(download.suggestedFilename()).toBe("audiencia.ics");
  });
}
