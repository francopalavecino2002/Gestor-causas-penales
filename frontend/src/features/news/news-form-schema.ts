import { z } from "zod";

import { formProblem, type FormProblem } from "@/lib/form-errors";

/** Same limit as the backend (`FirmPost.MAX_BODY_LENGTH`). */
export const POST_MAX = 1000;

export const postFormSchema = z.object({
  body: z
    .string()
    .refine((value) => value.trim().length > 0, "Escribí la novedad antes de publicarla.")
    .refine((value) => value.length <= POST_MAX, `Usá hasta ${POST_MAX} caracteres.`),
});

export type PostFormValues = z.output<typeof postFormSchema>;

/** A failed post, in the form's words. */
export function postProblem(error: unknown): FormProblem<"body"> {
  return formProblem(error, {
    subject: "la novedad",
    fields: ["body"],
    rules: [
      {
        type: "invalid-post",
        field: "body",
        message: `Escribí la novedad, con hasta ${POST_MAX} caracteres.`,
      },
    ],
  });
}
