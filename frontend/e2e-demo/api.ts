/// <reference lib="dom" />
import { expect, type Page } from "@playwright/test";

import { DEMO_FIRM, demoPassword, type DemoUser } from "./demo-users";

export interface ApiResponse {
  status: number;
  body: string;
}

/**
 * Calls the backend from inside the page, with `fetch`, so it shares the browser's own cookie jar
 * with the app (the session cookie is `Secure`, which Chromium honours on http://localhost). Like
 * the SPA, it echoes the `XSRF-TOKEN` cookie in `X-XSRF-TOKEN`, read fresh before every call
 * because the token rotates after login. The page must be on the app's origin.
 */
export async function callApi(
  page: Page,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResponse> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const readToken = () =>
        document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
          ?.slice("XSRF-TOKEN=".length);
      if (method !== "GET" && !readToken()) {
        await fetch("/api/v1/auth/csrf", { credentials: "same-origin" });
      }
      const token = readToken();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (token) headers["X-XSRF-TOKEN"] = decodeURIComponent(token);
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.text() };
    },
    { method, path, body },
  );
}

/** Password step of the login: 204 (signed in) or 202 (second factor required). */
export async function apiLogin(page: Page, user: DemoUser): Promise<ApiResponse> {
  return callApi(page, "POST", "/api/v1/auth/login", {
    tenant: DEMO_FIRM.slug,
    email: user.email,
    password: demoPassword(),
  });
}

/** Starts the TOTP enrollment of the signed-in user and returns its base32 secret. */
export async function startTwoFactorEnrollment(page: Page): Promise<string> {
  const response = await callApi(page, "POST", "/api/v1/me/two-factor/enrollment", {
    password: demoPassword(),
  });
  expect(
    response.status,
    `enrollment failed (${response.body}). If the user already has 2FA on from an interrupted ` +
      "run, recreate the gestor_e2e database (docs/DEMO.md).",
  ).toBe(200);
  const { secret } = JSON.parse(response.body) as { secret: string; otpauthUri: string };
  return secret;
}

export async function confirmTwoFactorEnrollment(page: Page, code: string): Promise<void> {
  const response = await callApi(page, "POST", "/api/v1/me/two-factor/enrollment/confirm", {
    code,
  });
  expect(response.status, `confirmation failed: ${response.body}`).toBe(200);
}

export async function disableTwoFactor(page: Page, code: string): Promise<ApiResponse> {
  return callApi(page, "POST", "/api/v1/me/two-factor/disable", {
    password: demoPassword(),
    code,
  });
}

/** Signs in through the login form; the user must not have 2FA on. Lands on the agenda. */
export async function signIn(page: Page, user: DemoUser): Promise<void> {
  await page.goto("/ingresar");
  await fillCredentials(page, user);
  await expect(page.getByRole("heading", { level: 1, name: "Audiencias de hoy" })).toBeVisible();
}

export async function fillCredentials(page: Page, user: DemoUser): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: "Ingresá a tu estudio" }),
  ).toBeVisible();
  await page.getByLabel("Estudio").fill(DEMO_FIRM.slug);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(demoPassword());
  await page.getByRole("button", { name: "Ingresá" }).click();
}

export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
