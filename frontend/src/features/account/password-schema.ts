import { z } from "zod";

import { PASSWORD_MAX } from "@/features/auth/login-schemas";

// Same rules as the backend (UserService): at least 12 characters, at most 72 bytes in UTF-8
// (bcrypt's limit), and different from the current one.
export const NEW_PASSWORD_MIN = 12;
export const NEW_PASSWORD_MAX_BYTES = 72;

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

export const TOO_LONG_MESSAGE =
  "La contraseña nueva es demasiado larga. Usá hasta 72 letras y números; las letras con acento y la ñ cuentan doble.";

/** Passwords are sent exactly as typed: no trimming. */
export function passwordChangeSchema(currentLabel: "actual" | "temporal") {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, `Escribí tu contraseña ${currentLabel}.`)
        .max(PASSWORD_MAX, `La contraseña tiene como máximo ${PASSWORD_MAX} caracteres.`),
      newPassword: z
        .string()
        .min(
          NEW_PASSWORD_MIN,
          `La contraseña nueva tiene que tener al menos ${NEW_PASSWORD_MIN} caracteres.`,
        )
        .refine((value) => utf8Length(value) <= NEW_PASSWORD_MAX_BYTES, TOO_LONG_MESSAGE),
      repeatPassword: z.string().min(1, "Repetí la contraseña nueva."),
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
        context.addIssue({
          code: "custom",
          path: ["repeatPassword"],
          message: "Las dos contraseñas nuevas no coinciden. Escribila igual en los dos campos.",
        });
      }
    });
}

export type PasswordChangeValues = z.infer<ReturnType<typeof passwordChangeSchema>>;
