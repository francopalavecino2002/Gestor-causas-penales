import { z } from "zod";

import { PASSWORD_MAX } from "@/features/auth/login-schemas";

// Same rules as the backend (UserService): at least 12 characters, at most 72 bytes in UTF-8
// (bcrypt's limit), and different from the current one.
export const NEW_PASSWORD_MIN = 12;
export const NEW_PASSWORD_MAX_BYTES = 72;

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

export const TOO_LONG_MESSAGE =
  "La contraseña nueva es demasiado larga. Usá hasta 72 letras y números; las letras con acento y la ñ cuentan doble.";

export const MISMATCH_MESSAGE =
  "Las dos contraseñas nuevas no coinciden. Escribila igual en los dos campos.";

// Passwords are sent exactly as typed: no trimming.
const newPassword = z
  .string()
  .min(
    NEW_PASSWORD_MIN,
    `La contraseña nueva tiene que tener al menos ${NEW_PASSWORD_MIN} caracteres.`,
  )
  .refine((value) => utf8Length(value) <= NEW_PASSWORD_MAX_BYTES, TOO_LONG_MESSAGE);

const repeatPassword = z.string().min(1, "Repetí la contraseña nueva.");

/** A new password and the same again, for the reset link (T71): there is no current one. */
export const passwordResetSchema = z
  .object({ newPassword, repeatPassword })
  .superRefine((values, context) => {
    if (values.repeatPassword && values.repeatPassword !== values.newPassword) {
      context.addIssue({ code: "custom", path: ["repeatPassword"], message: MISMATCH_MESSAGE });
    }
  });

export type PasswordResetValues = z.infer<typeof passwordResetSchema>;

export function passwordChangeSchema(currentLabel: "actual" | "temporal") {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, `Escribí tu contraseña ${currentLabel}.`)
        .max(PASSWORD_MAX, `La contraseña tiene como máximo ${PASSWORD_MAX} caracteres.`),
      newPassword,
      repeatPassword,
    })
    .superRefine((values, context) => {
      if (values.newPassword && values.newPassword === values.currentPassword) {
        context.addIssue({
          code: "custom",
          path: ["newPassword"],
          message: `Elegí una contraseña distinta de la ${currentLabel}.`,
        });
      }
      if (values.repeatPassword && values.repeatPassword !== values.newPassword) {
        context.addIssue({ code: "custom", path: ["repeatPassword"], message: MISMATCH_MESSAGE });
      }
    });
}

export type PasswordChangeValues = z.infer<ReturnType<typeof passwordChangeSchema>>;
