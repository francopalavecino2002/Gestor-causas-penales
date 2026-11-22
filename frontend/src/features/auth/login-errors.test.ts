import { describe, expect, it } from "vitest";

import {
  EXPIRED_MESSAGE,
  formatWait,
  loginErrorMessage,
  NETWORK_MESSAGE,
} from "@/features/auth/login-errors";
import { ApiError, NETWORK_ERROR, UNKNOWN_PROBLEM } from "@/lib/api";

describe("formatWait", () => {
  it.each([
    [1, "1 segundo"],
    [30, "30 segundos"],
    [60, "1 minuto"],
    [61, "2 minutos"],
    [900, "15 minutos"],
  ])("%i seconds reads as %s", (seconds, expected) => {
    expect(formatWait(seconds)).toBe(expected);
  });
});

describe("loginErrorMessage", () => {
  const error = (status: number, type: string, retryAfter?: number) =>
    new ApiError({ status, type, retryAfter });

  it("gives one generic message for wrong credentials", () => {
    const message = loginErrorMessage(error(401, "invalid-credentials"), "password");
    expect(message).toContain("no coinciden");
    expect(message).not.toMatch(/no existe|incorrecta/i);
  });

  it("tells a wrong TOTP apart from a wrong recovery code", () => {
    expect(loginErrorMessage(error(401, "invalid-second-factor"), "totp")).toContain(
      "app de autenticación",
    );
    expect(loginErrorMessage(error(401, "invalid-second-factor"), "recovery")).toContain(
      "recuperación",
    );
  });

  it("explains an expired second step and a lost connection", () => {
    expect(loginErrorMessage(error(401, "second-factor-expired"), "totp")).toBe(EXPIRED_MESSAGE);
    expect(loginErrorMessage(error(0, NETWORK_ERROR), "password")).toBe(NETWORK_MESSAGE);
  });

  it("says how long to wait when throttled, rounded up to minutes", () => {
    expect(loginErrorMessage(error(429, "login-throttled", 61), "password")).toContain(
      "esperá 2 minutos",
    );
    expect(loginErrorMessage(error(429, "login-throttled"), "password")).toContain("unos minutos");
  });

  it("separates server failures from anything else", () => {
    expect(loginErrorMessage(error(503, UNKNOWN_PROBLEM), "password")).toContain(
      "El servidor tuvo un problema",
    );
    expect(loginErrorMessage(error(400, UNKNOWN_PROBLEM), "password")).toBe(
      "No pudimos completar el ingreso. Probá de nuevo.",
    );
    expect(loginErrorMessage(new Error("boom"), "password")).toBe(
      "No pudimos completar el ingreso. Probá de nuevo.",
    );
  });
});
