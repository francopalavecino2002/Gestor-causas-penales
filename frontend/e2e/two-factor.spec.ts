/// <reference lib="dom" />
import { expect, test } from "@playwright/test";

import { DEMO_PASSWORD, DEMO_TOTP_CODE } from "../src/test/two-factor-fixtures";
import { mockBackend } from "./mock-backend";

test.use({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });

for (const viewport of [
  { name: "phone", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`${viewport.name}: an owner follows the Ajustes prompt and turns on two-factor`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockBackend(page, { signedIn: true, twoFactor: { enabled: false } });

    await page.goto("/ajustes");
    await page.getByRole("link", { name: "Activala ahora" }).click();
    await expect(page).toHaveURL(/\/ajustes\/usuarios#verificacion-en-dos-pasos$/);

    const section = page.getByRole("region", { name: "Verificación en dos pasos" });
    await section.getByRole("button", { name: "Activá la verificación en dos pasos" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tu contraseña").fill(DEMO_PASSWORD);
    await dialog.getByRole("button", { name: "Continuá" }).click();

    await expect(
      dialog.getByRole("img", {
        name: "Código QR para agregar tu cuenta a la app de autenticación",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    await dialog.getByRole("button", { name: "Ya la agregué, continuá" }).click();
    await dialog.getByLabel("Código de 6 números").fill(DEMO_TOTP_CODE);
    await dialog.getByRole("button", { name: "Activá la verificación" }).click();

    await expect(dialog.getByRole("list", { name: "Códigos de recuperación" })).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "Descargá los códigos" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("codigos-recuperacion-gestor.txt");

    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("alert")).toContainText("Antes de cerrar");
    await dialog.getByRole("checkbox", { name: "Ya los guardé en un lugar seguro" }).check();
    await dialog.getByRole("button", { name: "Listo" }).click();
    await expect(dialog).toBeHidden();

    await expect(section.getByText("Activada")).toBeVisible();
    await expect(section.getByText("Te quedan 10 códigos de recuperación sin usar.")).toBeVisible();
    await page.goto("/ajustes");
    await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Activala ahora" })).toHaveCount(0);
  });
}
