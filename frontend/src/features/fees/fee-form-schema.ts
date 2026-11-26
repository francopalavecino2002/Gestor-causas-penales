import { z } from "zod";

import { isIsoDate } from "@/features/agenda/agenda-dates";
import { integerDigits, parsePesos } from "@/features/fees/fee-format";
import type {
  CalculationRequest,
  FeeInstance,
  FeeRole,
  JusValueData,
} from "@/features/fees/fee-types";
import { formProblem, type FormProblem } from "@/lib/form-errors";
import { isApiError } from "@/lib/api";

/** Same limits as the backend (`CalculationRequest`, `JusValueData`). */
const AMOUNT_DIGITS = 15;
const JUS_DIGITS = 12;

const PESOS_HINT = "Escribí el monto en pesos, por ejemplo 1.500.000,50.";

export const FEE_ROLES = [
  "SPONSOR",
  "ATTORNEY",
  "SPONSOR_AND_ATTORNEY",
] as const satisfies readonly FeeRole[];
export const FEE_INSTANCES = [
  "FIRST",
  "APPEAL",
  "APPEAL_FULLY_REVOKED",
] as const satisfies readonly FeeInstance[];

export const calculatorSchema = z.object({
  area: z.string(),
  minimumCode: z.string().min(1, "Elegí el tipo de asunto."),
  amount: z
    .string()
    .trim()
    .refine((value) => value === "" || parsePesos(value) !== null, PESOS_HINT)
    .refine((value) => {
      const pesos = parsePesos(value);
      return pesos === null || integerDigits(pesos) <= AMOUNT_DIGITS;
    }, "El monto es demasiado grande: revisalo."),
  clientLostEntirely: z.boolean(),
  role: z.enum(FEE_ROLES),
  instance: z.enum(FEE_INSTANCES),
  date: z.string().refine(isIsoDate, "Elegí una fecha válida."),
});

export type CalculatorValues = z.output<typeof calculatorSchema>;

export function calculatorDefaults(today: string, area: string): CalculatorValues {
  return {
    area,
    minimumCode: "",
    amount: "",
    clientLostEntirely: false,
    role: "SPONSOR",
    instance: "FIRST",
    date: today,
  };
}

export function calculationRequestOf(values: CalculatorValues): CalculationRequest {
  return {
    amount: values.amount === "" ? null : parsePesos(values.amount),
    minimumCode: values.minimumCode,
    clientLostEntirely: values.amount !== "" && values.clientLostEntirely,
    role: values.role,
    instance: values.instance,
    date: values.date,
  };
}

/** The backend answers 409 `jus-value-missing` when no JUS value applies on the chosen day. */
export function isJusValueMissing(error: unknown): boolean {
  return isApiError(error) && error.type === "jus-value-missing";
}

export const jusValueSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1, "Escribí el valor del JUS en pesos.")
    .refine((value) => parsePesos(value) !== null, "Escribí el valor en pesos, por ejemplo 94.963,25.")
    .refine((value) => (parsePesos(value) ?? 1) > 0, "El valor tiene que ser mayor que cero.")
    .refine((value) => {
      const pesos = parsePesos(value);
      return pesos === null || integerDigits(pesos) <= JUS_DIGITS;
    }, "El valor es demasiado grande: revisalo."),
  validFrom: z.string().refine(isIsoDate, "Elegí desde qué día rige."),
});

export type JusValueValues = z.output<typeof jusValueSchema>;
export type JusValueField = keyof JusValueValues;

export function jusValueDataOf(values: JusValueValues): JusValueData {
  return { value: parsePesos(values.value) ?? 0, validFrom: values.validFrom };
}

const JUS_FIELDS: readonly JusValueField[] = ["value", "validFrom"];

/** A failed save of a JUS value, in the form's words. */
export function jusValueProblem(error: unknown): FormProblem<JusValueField> {
  return formProblem(error, {
    subject: "el valor del JUS",
    fields: JUS_FIELDS,
    rules: [
      {
        type: "duplicate-jus-value",
        field: "validFrom",
        message:
          "Ya hay un valor vigente desde ese día. Si te equivocaste, archivá ese primero en el historial.",
      },
      {
        type: "invalid-fee-data",
        detail: /anterior/i,
        field: "validFrom",
        message: "Elegí un día desde el 1/1/2000.",
      },
      {
        type: "invalid-fee-data",
        detail: /año/i,
        field: "validFrom",
        message: "Elegí un día de hasta un año desde hoy.",
      },
      {
        type: "invalid-fee-data",
        field: "value",
        message: "Revisá el valor: en pesos, mayor que cero y con hasta dos decimales.",
      },
      {
        type: "access-denied",
        message: "Solo la persona titular y los abogados del estudio cargan el valor del JUS.",
      },
    ],
  });
}
