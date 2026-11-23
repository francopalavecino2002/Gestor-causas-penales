import { z } from "zod";

import {
  instantAt,
  isIsoDate,
  isLocalTime,
  localDay,
  formatTime,
} from "@/features/agenda/agenda-dates";
import type { HearingData, HearingDetail, RequestedBy } from "@/features/hearings/hearing-api";

// Same limits as the backend (HearingData, RescheduleData).
export const DURATION_MIN = 5;
export const DURATION_MAX = 1440;
export const ROOM_MAX = 100;
export const JUDGE_MAX = 200;
export const OFIJU_REFERENCE_MAX = 100;
export const NOTES_MAX = 5000;
export const RESCHEDULE_REASON_MAX = 300;

/** Status codes of the hearing-statuses catalog the rules depend on (backend `HearingRules`). */
export const STATUS = {
  requested: "solicitada",
  scheduled: "programada",
  rescheduled: "reprogramada",
  held: "efectiva",
  reconverted: "reconvertida",
  recess: "cuarto-intermedio",
  suspended: "suspendida",
  cancelled: "cancelada",
} as const;

/** The hearing did not take place: only these carry a cancellation reason. */
export const NOT_HELD: readonly string[] = [STATUS.suspended, STATUS.cancelled];
/** The hearing took place: only these keep a result. */
export const WITH_RESULT: readonly string[] = [STATUS.held, STATUS.reconverted, STATUS.recess];

/**
 * The statuses a form offers: "reprogramada" only comes from rescheduling and "reconvertida"
 * needs the type it was held as, which is recorded with the result; both stay if current.
 */
export function offeredStatus(code: string, current?: string): boolean {
  if (code === current) return true;
  return code !== STATUS.rescheduled && code !== STATUS.reconverted;
}

export const REQUESTED_BY_LABELS: Record<RequestedBy, string> = {
  DEFENCE: "La defensa",
  PROSECUTION: "La fiscalía",
  PRIVATE_PROSECUTION: "La querella",
  COURT: "El tribunal o la OFIJU",
  OTHER: "Otra parte",
};

/** Common lengths, in minutes; the current one is added when it is not among them. */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480];

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursText = hours === 1 ? "1 hora" : `${hours} horas`;
  return rest === 0 ? hoursText : `${hoursText} y ${rest} minutos`;
}

const optionalText = (max: number) => z.string().trim().max(max, `Hasta ${max} caracteres.`);

export const hearingFormSchema = z.object({
  caseId: z.string().min(1, "Elegí la causa de la audiencia."),
  typeCode: z.string().min(1, "Elegí el tipo de audiencia."),
  date: z.string().refine(isIsoDate, "Elegí el día."),
  time: z.string().refine(isLocalTime, "Escribí la hora, por ejemplo 09:30."),
  durationMinutes: z
    .number()
    .int()
    .min(DURATION_MIN, `Dura al menos ${DURATION_MIN} minutos.`)
    .max(DURATION_MAX, "Dura como máximo 24 horas."),
  room: optionalText(ROOM_MAX),
  judge: optionalText(JUDGE_MAX),
  ofijuReference: optionalText(OFIJU_REFERENCE_MAX),
  requestedBy: z.enum(["", "DEFENCE", "PROSECUTION", "PRIVATE_PROSECUTION", "COURT", "OTHER"]),
  statusCode: z.string().min(1, "Elegí el estado."),
  cancellationReasonCode: z.string(),
  notes: optionalText(NOTES_MAX),
  lawyerIds: z.array(z.string()).min(1, "Elegí al menos a una persona del estudio que vaya."),
  defendantIds: z.array(z.string()),
  rescheduleReason: optionalText(RESCHEDULE_REASON_MAX),
});

export type HearingFormInput = z.input<typeof hearingFormSchema>;
export type HearingFormValues = z.output<typeof hearingFormSchema>;

export const HEARING_FORM_FIELDS = [
  "caseId",
  "typeCode",
  "date",
  "time",
  "durationMinutes",
  "room",
  "judge",
  "ofijuReference",
  "requestedBy",
  "statusCode",
  "cancellationReasonCode",
  "notes",
  "lawyerIds",
  "defendantIds",
  "rescheduleReason",
] as const;
export type HearingFormField = (typeof HEARING_FORM_FIELDS)[number];

/** A new hearing (case, day and lawyers prefilled when known) or an existing one. */
export function hearingFormDefaults(options: {
  hearing?: HearingDetail;
  caseId?: string;
  date?: string;
  lawyerIds?: string[];
  defendantIds?: string[];
  timeZone: string;
}): HearingFormInput {
  const { hearing, timeZone } = options;
  if (hearing) {
    return {
      caseId: hearing.caseId,
      typeCode: hearing.typeCode,
      date: localDay(hearing.startsAt, timeZone),
      time: formatTime(hearing.startsAt, timeZone),
      durationMinutes: hearing.durationMinutes,
      room: hearing.room ?? "",
      judge: hearing.judge ?? "",
      ofijuReference: hearing.ofijuReference ?? "",
      requestedBy: hearing.requestedBy ?? "",
      statusCode: hearing.statusCode,
      cancellationReasonCode: hearing.cancellationReasonCode ?? "",
      notes: hearing.notes ?? "",
      lawyerIds: hearing.lawyers.map((lawyer) => lawyer.id),
      defendantIds: hearing.defendants.map((defendant) => defendant.id),
      rescheduleReason: "",
    };
  }
  return {
    caseId: options.caseId ?? "",
    typeCode: "",
    date: options.date ?? "",
    time: "",
    durationMinutes: 60,
    room: "",
    judge: "",
    ofijuReference: "",
    requestedBy: "",
    statusCode: STATUS.scheduled,
    cancellationReasonCode: "",
    notes: "",
    lawyerIds: options.lawyerIds ?? [],
    defendantIds: options.defendantIds ?? [],
    rescheduleReason: "",
  };
}

const orNull = (value: string) => value || null;

/**
 * Why a hearing cannot move to the day and time in the form, or null when it can. The backend
 * refuses to reschedule a cancelled hearing or one with a result, and a reschedule sets the
 * status to «reprogramada»: a status change has to go in a separate edit.
 */
export function rescheduleBlock(statusCode: string, current: HearingDetail): string | null {
  if (current.statusCode === STATUS.cancelled) {
    return "Una audiencia cancelada no se reprograma: cargá una nueva.";
  }
  if (WITH_RESULT.includes(current.statusCode)) {
    return "Una audiencia que ya tiene resultado no se reprograma: cargá la siguiente.";
  }
  if (statusCode !== current.statusCode) {
    return "Para cambiar el día o la hora dejá el estado como estaba: la audiencia queda «Reprogramada». Después, en otra edición, cambiá el estado.";
  }
  return null;
}

/**
 * What to send: the body of `POST`/`PUT` and, for an existing hearing whose day or time
 * changed, the reschedule, which goes first (the backend only moves a date by rescheduling).
 * The edit after it carries what the backend then holds: the new date and «reprogramada»,
 * with no cancellation reason. The result and held-as type stay while the status allows them.
 */
export function hearingRequestOf(
  values: HearingFormValues,
  timeZone: string,
  current?: HearingDetail,
): { data: HearingData; reschedule?: { startsAt: string; reason: string | null } } {
  const startsAt = instantAt(values.date, values.time, timeZone);
  const moved =
    current !== undefined && new Date(startsAt).getTime() !== new Date(current.startsAt).getTime();
  const status = moved ? STATUS.rescheduled : values.statusCode;
  const data: HearingData = {
    typeCode: values.typeCode,
    startsAt: current && !moved ? current.startsAt : startsAt,
    durationMinutes: values.durationMinutes,
    room: orNull(values.room),
    judge: orNull(values.judge),
    ofijuReference: orNull(values.ofijuReference),
    requestedBy: values.requestedBy || null,
    statusCode: status,
    cancellationReasonCode: NOT_HELD.includes(status)
      ? orNull(values.cancellationReasonCode)
      : null,
    heldAsTypeCode: status === STATUS.reconverted ? (current?.heldAsTypeCode ?? null) : null,
    resultSummary: WITH_RESULT.includes(status) ? (current?.resultSummary ?? null) : null,
    notes: orNull(values.notes),
    defendantIds: values.defendantIds,
    lawyerIds: values.lawyerIds,
  };
  return moved
    ? { data, reschedule: { startsAt, reason: orNull(values.rescheduleReason) } }
    : { data };
}
