import { expect, test } from "@playwright/test";

import { horizontalOverflow, signIn } from "./api";
import { FIRM_TIME_ZONE, LABORAL_CASE, LUCIA } from "./demo-users";

test.use({ locale: "es-AR", timezoneId: FIRM_TIME_ZONE });

const DISCLAIMER = "Cálculo asistido: verificá con la norma.";

/**
 * The demo firm also works in civil and laboral (T63): the case list filters by area, and a
 * laboral case has its parties and its stage on the case instead of defendants, and deadlines
 * loaded by hand as judicial deadlines.
 */
test("the firm's civil and laboral cases, with their parties and manual deadlines", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, LUCIA);

  await page.goto("/causas");
  const area = page.getByLabel("Fuero");
  await expect(area.locator("option")).toHaveText([
    "Todos los fueros",
    "Penal",
    "Civil y comercial",
    "Laboral",
  ]);
  await area.selectOption({ label: "Civil y comercial" });
  await expect(page).toHaveURL(/fuero=civil/);
  await expect(page.getByText("3 causas en el estudio de Civil y comercial.")).toBeVisible();
  await area.selectOption({ label: "Laboral" });
  await expect(page.getByText("2 causas en el estudio de Laboral.")).toBeVisible();

  await page.getByRole("link", { name: LABORAL_CASE.caption }).click();
  await expect(page.getByRole("heading", { level: 1, name: LABORAL_CASE.caption })).toBeVisible();
  await expect(page.getByRole("region", { name: "Imputados", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Etapa y estado", exact: true })).toContainText(
    "Prueba",
  );

  const parties = page.getByRole("region", { name: "Partes", exact: true });
  await expect(parties.getByRole("listitem")).toHaveCount(LABORAL_CASE.parties.length);
  await expect(parties).toContainText("ART Muestra S.A.");
  await expect(parties).toContainText("Aseguradora (ART)");

  const deadlines = page.getByRole("region", { name: "Plazos", exact: true });
  await expect.poll(() => deadlines.getByRole("article").count()).toBe(2);
  await expect(deadlines).toContainText("Contestar la impugnación del dictamen médico.");
  await expect(deadlines.getByText(DISCLAIMER)).toHaveCount(2);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
