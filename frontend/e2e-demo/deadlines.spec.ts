import { expect, test } from "@playwright/test";

import { horizontalOverflow, signIn } from "./api";
import { DEMO_CASE, FIRM_TIME_ZONE, LUCIA } from "./demo-users";

test.use({ locale: "es-AR", timezoneId: FIRM_TIME_ZONE });

const DISCLAIMER = "Cálculo asistido: verificá con la norma.";

/**
 * The seed gives the detained defendant of the demo case his preventive prison deadlines (the
 * term the judge set and the one-year maximum, DemoDataSeeder). Each one shows its legal source
 * and the disclaimer: the system assists, the lawyer controls (CLAUDE.md rule 6).
 */
test("a detained defendant's deadlines show their legal source and the disclaimer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, LUCIA);

  await page.goto(`/causas?q=${DEMO_CASE.number}`);
  await page.getByRole("link", { name: DEMO_CASE.caption }).click();
  await expect(page.getByRole("heading", { level: 1, name: DEMO_CASE.caption })).toBeVisible();

  const [tomas] = DEMO_CASE.defendants;
  const deadlines = page.getByRole("region", { name: "Plazos", exact: true });
  const ofTomas = deadlines.getByRole("article").filter({ hasText: tomas });
  await expect.poll(() => ofTomas.count()).toBeGreaterThanOrEqual(2);

  const setByCourt = ofTomas.filter({
    has: page.getByRole("heading", {
      name: "Duración fijada en la resolución de prisión preventiva",
    }),
  });
  await expect(setByCourt).toContainText("Art. 116");
  await expect(setByCourt).toContainText("Persona detenida");
  await expect(setByCourt).toContainText(DISCLAIMER);

  const maximum = ofTomas.filter({
    has: page.getByRole("heading", { name: "Duración máxima de la prisión preventiva" }),
  });
  await expect(maximum).toContainText("Art. 119");
  // A rule still to confirm with a lawyer keeps its review tag visible.
  await expect(maximum).toContainText(/validar/i);
  await expect(maximum).toContainText(DISCLAIMER);

  // Every deadline card of the case carries the disclaimer, not only these two.
  const cards = await deadlines.getByRole("article").count();
  await expect(deadlines.getByText(DISCLAIMER)).toHaveCount(cards);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});
