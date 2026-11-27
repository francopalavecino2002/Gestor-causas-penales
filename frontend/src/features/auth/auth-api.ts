// Relative imports only: the shared fictitious backends (also used by the e2e mock,
// tsconfig.node.json) import the `Role` type from here and have no "@/" alias.
import { apiFetch, isUnauthorized } from "../../lib/api";

export type Role = "OWNER" | "LAWYER" | "PARALEGAL" | "ADMIN_STAFF";

/** The signed-in user, from GET /api/v1/me. */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  twoFactorEnabled: boolean;
  /**
   * The user still has the temporary password the owner gave them (ADR-0044): until they choose
   * their own, every other call answers 403 `password-change-required`.
   */
  passwordChangeRequired: boolean;
  tenant: { id: string; name: string; slug: string };
}

export interface Credentials {
  /** The firm's slug, shown to users as "Estudio". */
  tenant: string;
  email: string;
  password: string;
}

export type LoginResult = "signed-in" | "second-factor-required";

/** The current user, or `null` when nobody is signed in (401). */
export async function fetchMe(): Promise<Me | null> {
  try {
    return await apiFetch<Me>("/api/v1/me");
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

/** First login step. 204 means signed in; 202 asks for the second factor. */
export async function login(credentials: Credentials): Promise<LoginResult> {
  const body = await apiFetch<{ status?: string } | undefined>("/api/v1/auth/login", {
    method: "POST",
    body: credentials,
  });
  return body?.status === "SECOND_FACTOR_REQUIRED" ? "second-factor-required" : "signed-in";
}

/** Second login step: a 6-digit TOTP code or a recovery code. */
export async function verifySecondFactor(code: string): Promise<void> {
  await apiFetch("/api/v1/auth/login/second-factor", { method: "POST", body: { code } });
}

/**
 * Replaces the user's own password, also a temporary one. The server ends every session of the
 * user, this one included: after a 204 the user must sign in again with the new password.
 */
export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  await apiFetch("/api/v1/me/password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/api/v1/auth/logout", { method: "POST" });
}
