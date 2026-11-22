import { z } from "zod";

// Same limits as the backend (LoginRequest, SecondFactorRequest).
export const TENANT_MAX = 63;
export const EMAIL_MAX = 254;
export const PASSWORD_MAX = 128;
export const CODE_MAX = 32;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const credentialsSchema = z.object({
  tenant: z
    .string()
    .trim()
    .min(1, "Escribí el identificador de tu estudio.")
    .max(TENANT_MAX, `El identificador del estudio tiene como máximo ${TENANT_MAX} caracteres.`),
  email: z
    .string()
    .trim()
    .min(1, "Escribí tu email.")
    .max(EMAIL_MAX, `El email tiene como máximo ${EMAIL_MAX} caracteres.`)
    .regex(EMAIL_PATTERN, "Revisá el email: tiene que tener la forma nombre@dominio.com."),
  // Passwords are sent exactly as typed: no trimming.
  password: z
    .string()
    .min(1, "Escribí tu contraseña.")
    .max(PASSWORD_MAX, `La contraseña tiene como máximo ${PASSWORD_MAX} caracteres.`),
});

export type CredentialsValues = z.infer<typeof credentialsSchema>;

export const totpSchema = z.object({
  code: z
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Escribí los 6 números que muestra tu app.")),
});

export const recoverySchema = z.object({
  code: z
    .string()
    .trim()
    .max(CODE_MAX, `El código tiene como máximo ${CODE_MAX} caracteres.`)
    .refine(
      (value) => /^[A-Za-z0-9]{16}$/.test(value.replace(/[\s-]/g, "")),
      "Escribí el código completo: 16 letras y números, como XXXX-XXXX-XXXX-XXXX.",
    )
    .transform((value) => value.toUpperCase()),
});

export type CodeFormInput = z.input<typeof totpSchema>;
export type CodeFormOutput = z.output<typeof totpSchema>;
