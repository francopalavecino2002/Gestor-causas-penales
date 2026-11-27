import { z } from "zod";

import type { Role } from "@/features/auth/auth-api";
import { EMAIL_MAX } from "@/features/auth/login-schemas";
import { ROLE_ORDER } from "@/features/settings/settings-copy";

// Same limits as the backend (FirmUserController.NewUserRequest).
export const DISPLAY_NAME_MAX = 200;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleSchema = z
  .string()
  .refine((value): value is Role => (ROLE_ORDER as string[]).includes(value), "Elegí el rol.")
  .transform((value) => value as Role);

export const newUserSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Escribí el nombre y el apellido.")
    .max(DISPLAY_NAME_MAX, `El nombre tiene como máximo ${DISPLAY_NAME_MAX} caracteres.`),
  email: z
    .string()
    .trim()
    .min(1, "Escribí el email con el que va a ingresar.")
    .max(EMAIL_MAX, `El email tiene como máximo ${EMAIL_MAX} caracteres.`)
    .regex(EMAIL_PATTERN, "Revisá el email: tiene que tener la forma nombre@dominio.com."),
  role: roleSchema,
});

export type NewUserInput = z.input<typeof newUserSchema>;
export type NewUserOutput = z.output<typeof newUserSchema>;

export const roleChangeSchema = z.object({ role: roleSchema });

export type RoleChangeInput = z.input<typeof roleChangeSchema>;
export type RoleChangeOutput = z.output<typeof roleChangeSchema>;
