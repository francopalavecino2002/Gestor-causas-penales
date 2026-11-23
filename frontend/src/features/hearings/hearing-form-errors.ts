import {
  HEARING_FORM_FIELDS,
  type HearingFormField,
} from "@/features/hearings/hearing-form-schema";
import { formProblem, type FormProblem, type ProblemRule } from "@/lib/form-errors";

/** The backend's hearing problems (HearingService, HearingRules, Hearing.apply), in Spanish. */
const HEARING_RULES: ProblemRule<HearingFormField>[] = [
  {
    type: "invalid-hearing-data",
    detail: /changes by rescheduling/i,
    field: "date",
    message: "La fecha se cambia reprogramando la audiencia. Volvé a elegir el día y la hora.",
  },
  {
    type: "invalid-hearing-data",
    detail: /same as the current/i,
    field: "date",
    message: "Es la misma fecha que ya tenía. Elegí otra o dejala como estaba.",
  },
  {
    type: "invalid-hearing-data",
    detail: /at least one lawyer|no responsible lawyer/i,
    field: "lawyerIds",
    message: "Elegí al menos a una persona del estudio que vaya.",
  },
  {
    type: "invalid-hearing-data",
    detail: /archived user/i,
    field: "lawyerIds",
    message: "Una de las personas elegidas ya no tiene la cuenta activa. Sacala de la lista.",
  },
  {
    type: "invalid-hearing-data",
    detail: /defendant/i,
    field: "defendantIds",
    message: "Uno de los imputados elegidos ya no está en la causa. Recargá y volvé a elegir.",
  },
  {
    type: "invalid-hearing-data",
    detail: /hearing-types/i,
    field: "typeCode",
    message: "Ese tipo de audiencia ya no se ofrece en el estudio. Elegí otro.",
  },
  {
    type: "invalid-hearing-data",
    detail: /cancellation/i,
    field: "cancellationReasonCode",
    message: "El motivo solo va en una audiencia suspendida o cancelada.",
  },
  {
    type: "invalid-hearing-data",
    detail: /result or a next hearing/i,
    field: "statusCode",
    message:
      "Esta audiencia tiene cargado un resultado o la audiencia siguiente: solo puede quedar como realizada, reconvertida o cuarto intermedio.",
  },
  {
    type: "invalid-hearing-data",
    detail: /reprogramada|reconverted|held as|hearing-statuses/i,
    field: "statusCode",
    message: "Ese estado no se puede elegir acá. Elegí otro.",
  },
  {
    type: "invalid-hearing-state",
    detail: /cancelled/i,
    field: "date",
    message: "Una audiencia cancelada no se reprograma: cargá una nueva.",
  },
  {
    type: "invalid-hearing-state",
    detail: /result/i,
    field: "date",
    message: "Una audiencia que ya tiene resultado no se reprograma: cargá la siguiente.",
  },
  {
    type: "archived-record",
    detail: /hearing is archived/i,
    message: "La audiencia está archivada: para cambiarla, primero hay que restaurarla.",
  },
];

export function hearingFormProblem(error: unknown): FormProblem<HearingFormField> {
  return formProblem(error, {
    subject: "la audiencia",
    rules: HEARING_RULES,
    fields: HEARING_FORM_FIELDS,
  });
}
