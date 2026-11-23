import { expect, test } from "@playwright/test";

import {
  apiLogin,
  callApi,
  confirmTwoFactorEnrollment,
  disableTwoFactor,
  fillCredentials,
  startTwoFactorEnrollment,
} from "./api";
import { JULIAN } from "./demo-users";
import { base32Decode, codeAt, nextCode, stepAt } from "./totp";

/**
 * Julián has no 2FA in the seed: the test enrolls it through the API, signs in through the form
 * with a code of a later step (a step is accepted only once per user) and turns it off again at
 * the end, so the suite can run again against the same database.
 */
test("login with a password and a TOTP code lands on the agenda", async ({ page }) => {
  // Cleanup may wait up to one TOTP step for a fresh code.
  test.setTimeout(120_000);

  await page.goto("/ingresar");
  const login = await apiLogin(page, JULIAN);
  expect(login.status, `login of ${JULIAN.email} failed: ${login.body}`).toBe(204);

  const secret = base32Decode(await startTwoFactorEnrollment(page));
  let lastStep = stepAt();
  await confirmTwoFactorEnrollment(page, codeAt(secret, lastStep));

  try {
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.goto("/ingresar");
    await fillCredentials(page, JULIAN);

    const codeInput = page.getByLabel("Código de verificación");
    await expect(codeInput).toBeFocused();
    const next = await nextCode(secret, lastStep);
    await codeInput.fill(next.code);
    lastStep = next.step;
    await page.getByRole("button", { name: "Verificá el código" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tu cuenta: Julián Muestra/ })).toBeVisible();
  } finally {
    // Back to the seed's state. If the UI login did not finish, sign in again through the API.
    const me = await callApi(page, "GET", "/api/v1/me");
    if (me.status !== 200) {
      await page.context().clearCookies();
      const password = await apiLogin(page, JULIAN);
      if (password.status === 202) {
        const second = await nextCode(secret, lastStep);
        lastStep = second.step;
        const done = await callApi(page, "POST", "/api/v1/auth/login/second-factor", {
          code: second.code,
        });
        expect(done.status, `second factor for cleanup failed: ${done.body}`).toBe(204);
      }
    }
    const off = await nextCode(secret, lastStep);
    const disabled = await disableTwoFactor(page, off.code);
    expect(disabled.status, `disabling 2FA failed: ${disabled.body}`).toBe(204);
  }
});
