import { z } from "zod";

import { PASSWORD_MAX, recoverySchema, totpSchema } from "@/features/auth/login-schemas";

/** A code from the authenticator app, or one of the recovery codes. */
export type CodeMode = "totp" | "recovery";

// Passwords are sent exactly as typed: no trimming (same rule as the login).
const password = z
  .string()
  .min(1, "Escribí tu contraseña.")
  .max(PASSWORD_MAX, `La contraseña tiene como máximo ${PASSWORD_MAX} caracteres.`);

export const passwordSchema = z.object({ password });

/** Enrollment is confirmed only with the app: there are no recovery codes yet. */
export const enrollCodeSchema = totpSchema;

export function codeSchema(mode: CodeMode) {
  return mode === "totp" ? totpSchema : recoverySchema;
}

export function disableSchema(mode: CodeMode) {
  return z.object({ password, code: codeSchema(mode).shape.code });
}

export type PasswordValues = z.infer<typeof passwordSchema>;

export type DisableValues = z.infer<ReturnType<typeof disableSchema>>;
