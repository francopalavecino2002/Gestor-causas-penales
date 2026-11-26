// Relative imports only: the shared test backend (also used by the e2e mock, tsconfig.node.json)
// imports these types and has no "@/" alias.
import { apiFetch } from "../../lib/api";

/** Whether the second step is on, and how many recovery codes are still unused (ADR-0009). */
export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

/**
 * What an authenticator app needs: the base32 secret, for typing it by hand, and the `otpauth://`
 * address the QR code carries. Both stay in the browser: the QR is drawn here, never by a service.
 */
export interface TwoFactorEnrollment {
  secret: string;
  otpauthUri: string;
}

/** Ten single-use codes, answered in clear text only this once. */
export interface RecoveryCodes {
  recoveryCodes: string[];
}

const BASE = "/api/v1/me/two-factor";

export function fetchTwoFactorStatus(signal?: AbortSignal): Promise<TwoFactorStatus> {
  return apiFetch<TwoFactorStatus>(BASE, { signal });
}

/** Needs the password; starting again replaces a secret that was never confirmed. */
export function startEnrollment(password: string): Promise<TwoFactorEnrollment> {
  return apiFetch<TwoFactorEnrollment>(`${BASE}/enrollment`, {
    method: "POST",
    body: { password },
  });
}

/** Turns two-factor on with a code from the new secret. */
export function confirmEnrollment(code: string): Promise<RecoveryCodes> {
  return apiFetch<RecoveryCodes>(`${BASE}/enrollment/confirm`, {
    method: "POST",
    body: { code },
  });
}

/** Replaces the ten codes; needs a current code from the app or an unused recovery code. */
export function regenerateRecoveryCodes(code: string): Promise<RecoveryCodes> {
  return apiFetch<RecoveryCodes>(`${BASE}/recovery-codes`, { method: "POST", body: { code } });
}

/** Turns two-factor off; needs the password and a code. */
export function disableTwoFactor(password: string, code: string): Promise<void> {
  return apiFetch(`${BASE}/disable`, { method: "POST", body: { password, code } });
}
