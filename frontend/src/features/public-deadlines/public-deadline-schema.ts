import { z } from "zod";

import { isIsoDate, isLocalTime } from "@/features/agenda/agenda-dates";
import type {
  PublicCalculationRequest,
  PublicRule,
} from "@/features/public-deadlines/public-deadline-types";

/** The time field only exists for terms in hours, so it is checked against the chosen rule. */
export function publicCalculatorSchema(rules: PublicRule[]) {
  const inHours = new Set(
    rules.filter((rule) => rule.computation === "HOURS").map((rule) => rule.code),
  );
  return z
    .object({
      rule: z.string().min(1, "Elegí el plazo."),
      startDate: z.string().refine(isIsoDate, "Elegí una fecha válida."),
      startTime: z.string(),
    })
    .superRefine((values, context) => {
      if (inHours.has(values.rule) && !isLocalTime(values.startTime)) {
        context.addIssue({
          code: "custom",
          path: ["startTime"],
          message: "Este plazo corre en horas: escribí la hora, por ejemplo 10:30.",
        });
      }
    });
}

export type PublicCalculatorValues = z.output<ReturnType<typeof publicCalculatorSchema>>;

export function publicCalculationRequestOf(
  values: PublicCalculatorValues,
  rule: PublicRule | undefined,
): PublicCalculationRequest {
  return {
    rule: values.rule,
    startDate: values.startDate,
    ...(rule?.computation === "HOURS" ? { startTime: values.startTime } : {}),
  };
}
