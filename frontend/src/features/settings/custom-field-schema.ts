import { z } from "zod";

// Same limits as the backend (CustomFieldDefinition).
export const FIELD_LABEL_MAX = 100;
export const FIELD_OPTIONS_MAX = 100;

const labelSchema = (subject: string) =>
  z
    .string()
    .trim()
    .min(1, `Escribí el nombre ${subject}.`)
    .max(FIELD_LABEL_MAX, `El nombre tiene como máximo ${FIELD_LABEL_MAX} caracteres.`);

/** The custom field form: a list needs a visible option, and no two options share a name. */
export const customFieldSchema = z
  .object({
    label: labelSchema("del campo"),
    type: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN", "LIST"]),
    required: z.boolean(),
    options: z.array(
      z.object({
        /** The option's code once saved; empty for an option added in this form. */
        code: z.string(),
        label: labelSchema("de la opción"),
        hidden: z.boolean(),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.type !== "LIST") return;
    if (value.options.length > FIELD_OPTIONS_MAX) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `Una lista tiene como máximo ${FIELD_OPTIONS_MAX} opciones.`,
      });
    } else if (!value.options.some((option) => !option.hidden)) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Una lista necesita al menos una opción visible. Agregá una.",
      });
    }
    const seen = new Set<string>();
    value.options.forEach((option, index) => {
      const key = option.label.trim().toLocaleLowerCase("es-AR");
      if (key && seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "label"],
          message: "Ya hay una opción con este nombre.",
        });
      }
      seen.add(key);
    });
  });

export type CustomFieldFormInput = z.input<typeof customFieldSchema>;
export type CustomFieldFormOutput = z.output<typeof customFieldSchema>;
