import { expect, test } from "@playwright/test";

import { horizontalOverflow, signIn } from "./api";
import { DEMO_CASE, FIRM_TIME_ZONE, LUCIA } from "./demo-users";

test.use({ locale: "es-AR", timezoneId: FIRM_TIME_ZONE });

test("find the demo case by its number and see its two defendants", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, LUCIA);

  await page
    .getByRole("navigation", { name: "Secciones" })
    .getByRole("link", { name: "Causas" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Causas" })).toBeVisible();
  // The seed has about 25 cases.
  await expect(page.getByText(/^\d+ causas en el estudio\.$/)).toBeVisible();

  await page.getByRole("searchbox", { name: "Buscá una causa" }).fill(DEMO_CASE.number);
  await expect(page).toHaveURL(/\/causas\?q=DEMO-001$/);
  await expect(page.getByText(`1 causa para «${DEMO_CASE.number}».`)).toBeVisible();
  const table = page.getByRole("table", { name: /^Causas, página 1 de 1$/ });
  await expect(table.getByRole("row")).toHaveCount(2);

  await table.getByRole("link", { name: DEMO_CASE.caption }).click();
  await expect(page).toHaveURL(/\/causas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: DEMO_CASE.caption })).toBeVisible();

  const defendants = page.getByRole("region", { name: "Imputados", exact: true });
  await expect(defendants.getByRole("article")).toHaveCount(2);
  const [tomas, gabriela] = DEMO_CASE.defendants;
  // Tomás is in preventive prison; Gabriela reports periodically.
  await expect(defendants.getByRole("article", { name: tomas })).toContainText("Robo agravado");
  await expect(defendants.getByRole("article", { name: tomas })).toContainText(
    "Prisión preventiva",
  );
  await expect(defendants.getByRole("article", { name: gabriela })).toContainText("Encubrimiento");
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
