import { apiFetch, isUnauthorized } from "@/lib/api";

export type Role = "OWNER" | "LAWYER" | "PARALEGAL" | "ADMIN_STAFF";

/** The signed-in user, from GET /api/v1/me. */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  twoFactorEnabled: boolean;
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

export async function logout(): Promise<void> {
  await apiFetch("/api/v1/auth/logout", { method: "POST" });
}
