// Relative imports only: the e2e mock backend (tsconfig.node.json) uses this file too.
import type { TwoFactorStatus } from "../features/two-factor/two-factor-api";

/** The fictitious password of the demo user (the same one the e2e login types). */
export const DEMO_PASSWORD = "una-clave-ficticia";

/** The code the fictitious authenticator app shows. */
export const DEMO_TOTP_CODE = "246810";

/** The RFC 6238 test secret ("12345678901234567890" in base32): public and fictitious. */
export const DEMO_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

export const DEMO_OTPAUTH_URI =
  "otpauth://totp/Gestor%20Penal:lucia.ejemplo%40example.com" +
  `?secret=${DEMO_SECRET}&issuer=Gestor%20Penal&algorithm=SHA1&digits=6&period=30`;

/** Ten fictitious recovery codes; each generation gets its own, so new ones replace the old. */
export function demoRecoveryCodes(generation: number): string[] {
  const batch = String(generation).padStart(4, "0");
  return Array.from(
    { length: 10 },
    (_, index) => `FAKE-2026-${batch}-${String(index + 1).padStart(4, "0")}`,
  );
}

const normalize = (code: string) => code.replace(/[\s-]/g, "").toUpperCase();

export interface TwoFactorAnswer {
  status: number;
  json?: unknown;
  /** Problem type, e.g. "invalid-confirmation". */
  problem?: string;
  headers?: Record<string, string>;
}

/**
 * The `/api/v1/me/two-factor` endpoints with state, like TwoFactorService: the password and the
 * codes are checked, a confirmed enrollment turns it on, a used recovery code stops working.
 * `throttled` answers every attempt with 429 and `Retry-After`, like the login throttle.
 */
export function twoFactorBackend(
  initial: { enabled?: boolean; remaining?: number; throttled?: boolean } = {},
) {
  let generation = 0;
  const state = {
    enabled: initial.enabled ?? false,
    pending: false,
    throttled: initial.throttled ?? false,
    codes: initial.enabled ? demoRecoveryCodes(0).slice(0, initial.remaining ?? 10) : [],
  };

  const status = (): TwoFactorStatus => ({
    enabled: state.enabled,
    recoveryCodesRemaining: state.enabled ? state.codes.length : 0,
  });

  /** Accepts the app's code or an unused recovery code, which it then spends. */
  const acceptSecondFactor = (code: string) => {
    if (code.trim() === DEMO_TOTP_CODE) return true;
    const index = state.codes.findIndex((candidate) => normalize(candidate) === normalize(code));
    if (index < 0) return false;
    state.codes.splice(index, 1);
    return true;
  };

  const issueCodes = () => {
    state.codes = demoRecoveryCodes(++generation);
    return { status: 200, json: { recoveryCodes: [...state.codes] } };
  };

  const answer = (
    method: string,
    path: string,
    body: () => unknown,
  ): TwoFactorAnswer | undefined => {
    if (!path.startsWith("/api/v1/me/two-factor")) return undefined;
    if (method === "GET" && path === "/api/v1/me/two-factor")
      return { status: 200, json: status() };
    if (method !== "POST") return undefined;

    if (state.throttled) {
      return { status: 429, problem: "login-throttled", headers: { "Retry-After": "120" } };
    }
    const invalid = { status: 422, problem: "invalid-confirmation" };
    const conflict = { status: 409, problem: "two-factor-state" };

    switch (path) {
      case "/api/v1/me/two-factor/enrollment": {
        const { password } = body() as { password: string };
        if (password !== DEMO_PASSWORD) return invalid;
        if (state.enabled) return conflict;
        state.pending = true;
        return { status: 200, json: { secret: DEMO_SECRET, otpauthUri: DEMO_OTPAUTH_URI } };
      }
      case "/api/v1/me/two-factor/enrollment/confirm": {
        const { code } = body() as { code: string };
        if (state.enabled || !state.pending) return conflict;
        if (code !== DEMO_TOTP_CODE) return invalid;
        state.enabled = true;
        state.pending = false;
        return issueCodes();
      }
      case "/api/v1/me/two-factor/recovery-codes": {
        const { code } = body() as { code: string };
        if (!state.enabled) return conflict;
        if (!acceptSecondFactor(code)) return invalid;
        return issueCodes();
      }
      case "/api/v1/me/two-factor/disable": {
        const { password, code } = body() as { password: string; code: string };
        if (!state.enabled) return conflict;
        if (password !== DEMO_PASSWORD || !acceptSecondFactor(code)) return invalid;
        state.enabled = false;
        state.codes = [];
        return { status: 204 };
      }
      default:
        return undefined;
    }
  };

  return { answer, state, status };
}
