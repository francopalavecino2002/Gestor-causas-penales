/// <reference lib="dom" />
import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  apiLogin,
  callApi,
  confirmTwoFactorEnrollment,
  disableTwoFactor,
  fillCredentials,
  signIn,
  startTwoFactorEnrollment,
} from "./api";
import { demoDay } from "./demo-day";
import {
  DEMO_CASE,
  DEMO_FIRM,
  DETAINEES_CASE,
  FIRM_TIME_ZONE,
  LABORAL_CASE,
  LUCIA,
  PROBATION_CASE,
  SOFIA,
} from "./demo-users";
import { base32Decode, codeAt, nextCode, stepAt } from "./totp";

/*
 * Screenshots of every screen of the guided demo (docs/DEMO.md, «Guion de 10 minutos»), taken
 * against the real backend and its fictitious seed. Not a regression check: the demo suite only
 * matches *.spec.ts. Run it with `bash scripts/e2e-demo.sh --screenshots`. Files land in
 * docs/screenshots/demo/ at the repository root, named <step>-<screen>-<viewport>.png.
 */

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
} as const;
type ViewportName = keyof typeof VIEWPORTS;

const OUT_DIR = "../docs/screenshots/demo";

async function newPage(browser: Browser, viewport: ViewportName): Promise<Page> {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "es-AR",
    timezoneId: FIRM_TIME_ZONE,
  });
  return context.newPage();
}

/** Waits for the data, the fonts and two frames, with the pointer out of the way. */
async function settle(page: Page) {
  await page.locator("h1").first().waitFor();
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

async function shot(page: Page, name: string, viewport: ViewportName) {
  await settle(page);
  await page.screenshot({ path: `${OUT_DIR}/${name}-${viewport}.png` });
}

/** Puts a section's heading near the top, below the mobile top bar. */
async function scrollToSection(page: Page, name: string) {
  const section = page.getByRole("region", { name, exact: true });
  await section.waitFor();
  await section.evaluate((element) =>
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 76),
  );
}

async function openCase(page: Page, demoCase: { number: string; caption: string }) {
  await page.goto(`/causas?q=${demoCase.number}`);
  await page.getByRole("link", { name: demoCase.caption }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: demoCase.caption })).toBeVisible();
}

const HEADER = "tipo_persona;nombres;apellidos;telefono;domicilio";
const csv = (name: string, rows: string[]) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from([HEADER, ...rows].join("\r\n") + "\r\n", "utf8"),
});

test.describe.configure({ mode: "serial", timeout: 240_000 });

test("login and second factor", async ({ browser }) => {
  for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
    const page = await newPage(browser, viewport);
    await page.goto(`/ingresar?estudio=${DEMO_FIRM.slug}`);
    await shot(page, "01-login", viewport);
    await page.context().close();
  }

  // Sofía has no 2FA in the seed: turn it on through the API, take the code step in another
  // browser, then turn it off again so the database stays as seeded.
  const owner = await newPage(browser, "desktop");
  await owner.goto("/ingresar");
  const login = await apiLogin(owner, SOFIA);
  expect(login.status, `login of ${SOFIA.email} failed: ${login.body}`).toBe(204);
  const secret = base32Decode(await startTwoFactorEnrollment(owner));
  const lastStep = stepAt();
  let enabled = false;
  try {
    await confirmTwoFactorEnrollment(owner, codeAt(secret, lastStep));
    enabled = true;
    const page = await newPage(browser, "mobile");
    await page.goto("/ingresar");
    await fillCredentials(page, SOFIA);
    await page.getByLabel("Código de verificación").waitFor();
    await shot(page, "02-second-factor", "mobile");
    await page.setViewportSize(VIEWPORTS.desktop);
    await shot(page, "02-second-factor", "desktop");
    await page.context().close();
  } finally {
    if (enabled) await turnOffTwoFactor(owner, secret, lastStep);
    await owner.context().close();
  }
});

/** Turns Sofía's 2FA off again, signing her back in if the session ended meanwhile. */
async function turnOffTwoFactor(
  owner: Page,
  secret: ReturnType<typeof base32Decode>,
  step: number,
) {
  let lastStep = step;
  const me = await callApi(owner, "GET", "/api/v1/me");
  if (me.status !== 200) {
    await owner.context().clearCookies();
    const password = await apiLogin(owner, SOFIA);
    if (password.status === 202) {
      const second = await nextCode(secret, lastStep);
      lastStep = second.step;
      await callApi(owner, "POST", "/api/v1/auth/login/second-factor", { code: second.code });
    }
  }
  const off = await nextCode(secret, lastStep);
  const disabled = await disableTwoFactor(owner, off.code);
  expect(disabled.status, `disabling 2FA failed: ${disabled.body}`).toBe(204);
}

for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
  test(`the guided demo as the firm's owner (${viewport})`, async ({ browser }) => {
    const page = await newPage(browser, viewport);
    await signIn(page, LUCIA);
    const day = demoDay();

    // Agenda: today, then the week.
    await page.goto(day ? `/?fecha=${day}` : "/");
    await page.getByRole("article").first().waitFor();
    await shot(page, "03-agenda-today", viewport);
    await page.goto(day ? `/?vista=semana&fecha=${day}` : "/?vista=semana");
    await page.getByRole("article").first().waitFor();
    await shot(page, "04-agenda-week", viewport);

    // Deadlines: everything that needs attention, then only detainees.
    await page.goto("/plazos");
    await page.getByRole("article").first().waitFor();
    await shot(page, "05-deadlines", viewport);
    await page.goto("/plazos?detenidos=si");
    await page.getByRole("article").first().waitFor();
    await shot(page, "06-deadlines-detainees", viewport);

    // Cases: the list, a case with three defendants, the deadlines of a detainee, a probation.
    await page.goto("/causas");
    await page.locator("article:visible, table:visible").first().waitFor();
    await shot(page, "07-case-list", viewport);
    await openCase(page, DETAINEES_CASE);
    await shot(page, "08-case-summary", viewport);
    await scrollToSection(page, "Imputados");
    await shot(page, "09-case-defendants", viewport);
    await openCase(page, DEMO_CASE);
    await page
      .getByRole("region", { name: "Plazos", exact: true })
      .getByRole("article")
      .first()
      .waitFor();
    await scrollToSection(page, "Plazos");
    await shot(page, "10-case-deadlines", viewport);
    await openCase(page, PROBATION_CASE);
    await page
      .getByRole("region", { name: "Plazos", exact: true })
      .getByRole("article")
      .first()
      .waitFor();
    await scrollToSection(page, "Plazos");
    await shot(page, "11-case-probation", viewport);

    // Settings: what the firm configures without code.
    await page.goto("/ajustes");
    await shot(page, "12-settings", viewport);
    await page.goto("/ajustes/catalogos");
    await page.getByRole("listitem").first().waitFor();
    await shot(page, "13-settings-catalogs", viewport);
    await page.goto("/ajustes/campos");
    await shot(page, "14-settings-fields", viewport);
    await page.goto("/ajustes/plazos");
    await page.getByRole("article").first().waitFor();
    await shot(page, "15-settings-deadline-rules", viewport);
    await page.goto("/ajustes/usuarios");
    await shot(page, "16-settings-users", viewport);

    // Import: a sheet with an error, then the corrected one. Each viewport imports the same two
    // people, which works because scripts/e2e-demo.sh recreates the database on every run.
    await page.goto("/importar");
    await shot(page, "17-import-kind", viewport);
    await page.getByRole("radio", { name: /^Personas/ }).check();
    await page.getByRole("button", { name: "Continuá" }).click();
    await page
      .getByLabel(/Elegí el archivo/)
      .setInputFiles(
        csv("personas-con-errores.csv", [
          "humana;Clara;Captura Ficticia;2990000011;Calle Ficticia 300, Neuquén",
          "humana;Darío;;2990000012;Calle Ficticia 400, Neuquén",
        ]),
      );
    await page.getByRole("heading", { name: "Hay 1 fila para corregir" }).waitFor();
    await shot(page, "18-import-errors", viewport);
    await page.getByRole("button", { name: "Subí la planilla corregida" }).click();
    await page
      .getByLabel(/Elegí el archivo/)
      .setInputFiles(
        csv("personas.csv", [
          "humana;Clara;Captura Ficticia;2990000011;Calle Ficticia 300, Neuquén",
          "humana;Darío;Captura Ejemplo;2990000012;Calle Ficticia 400, Neuquén",
        ]),
      );
    await page.getByRole("button", { name: "Confirmá e importá 2 filas" }).click();
    await page.getByRole("heading", { name: "Listo: importaste las personas" }).waitFor();
    await shot(page, "19-import-done", viewport);

    await page.goto("/personas");
    await shot(page, "20-persons", viewport);

    // Other areas: the civil cases of the firm, then a laboral case with its parties.
    await page.goto("/causas?fuero=civil");
    await page.locator("article:visible, table:visible").first().waitFor();
    await shot(page, "21-case-list-civil", viewport);
    await openCase(page, LABORAL_CASE);
    await page
      .getByRole("region", { name: "Plazos", exact: true })
      .getByRole("article")
      .first()
      .waitFor();
    await shot(page, "22-case-laboral", viewport);

    await page.context().close();
  });
}
