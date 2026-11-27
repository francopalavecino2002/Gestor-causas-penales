import { z } from "zod";

import { MISMATCH_MESSAGE, newPassword, repeatPassword } from "@/features/account/password-schema";
import { credentialsSchema } from "@/features/auth/login-schemas";

// Same limits as the backend (SignupController, SignupService).
export const FIRM_NAME_MAX = 200;
export const OWNER_NAME_MAX = 200;

export const signupSchema = z
  .object({
    firmName: z
      .string()
      .trim()
      .min(1, "Escribí el nombre del estudio.")
      .max(FIRM_NAME_MAX, `El nombre del estudio tiene como máximo ${FIRM_NAME_MAX} caracteres.`),
    practiceAreas: z.array(z.string()).min(1, "Elegí al menos un fuero."),
    ownerName: z
      .string()
      .trim()
      .min(1, "Escribí tu nombre.")
      .max(OWNER_NAME_MAX, `Tu nombre tiene como máximo ${OWNER_NAME_MAX} caracteres.`),
    email: credentialsSchema.shape.email,
    newPassword,
    repeatPassword,
    // The honeypot, sent as `website`. Its name and label look like no real field, so browser
    // autofill and password managers leave it empty for people.
    hpCheck: z.string(),
  })
  .superRefine((values, context) => {
    if (values.repeatPassword && values.repeatPassword !== values.newPassword) {
      context.addIssue({ code: "custom", path: ["repeatPassword"], message: MISMATCH_MESSAGE });
    }
  });

export type SignupValues = z.infer<typeof signupSchema>;
