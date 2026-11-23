import { z } from "zod";

import type { CaseData, DefendantData } from "@/features/cases/case-write-api";
import type { CaseDetail, DefendantView } from "@/features/cases/case-types";
import {
  checkPersonChoice,
  EMPTY_PERSON_CHOICE,
  personChoiceSchema,
} from "@/features/persons/person-schema";

// Same limits as the backend (CaseData, DefendantData).
export const CAPTION_MAX = 300;
export const NUMBER_MAX = 40;
export const COUNSEL_NAME_MAX = 200;

/** Same shape as the backend's MpfLegajo.FORMAT: MPF, seat letters, number/year. */
const MPF_LEGAJO = /^MPF[A-Z]{2,4}\s*\d{1,7}\/\d{4}$/i;

/** The stage a closed defendant is in, and only a closed one (backend `Defendant.CLOSED_STAGE`). */
export const CLOSED_STAGE = "cerrada";
/** A new defendant starts here unless the form says otherwise (backend default). */
export const FIRST_STAGE = "averiguacion-preliminar";

const optionalNumber = z.string().trim().max(NUMBER_MAX, `Hasta ${NUMBER_MAX} caracteres.`);

/**
 * The case form. `requireResponsible` is set when the signed-in user cannot be the responsible
 * (a paralegal or administrative member), so they have to pick one.
 */
export function caseFormSchema(options: { requireResponsible: boolean; creating: boolean }) {
  return z
    .object({
      caption: z
        .string()
        .trim()
        .min(1, "Escribí la carátula.")
        .max(CAPTION_MAX, `La carátula tiene como máximo ${CAPTION_MAX} caracteres.`),
      internalNumber: optionalNumber,
      mpfLegajo: optionalNumber.refine(
        (value) => value === "" || MPF_LEGAJO.test(value),
        "Escribilo como figura en el legajo, por ejemplo MPFNQ 12345/2026.",
      ),
      ofijuNumber: optionalNumber,
      pehuenNumber: optionalNumber,
      circumscriptionCode: z.string().min(1, "Elegí la circunscripción."),
      actionType: z.enum(["PUBLIC", "PUBLIC_ON_COMPLAINT", "PRIVATE"]),
      represents: z.enum(["DEFENCE", "PRIVATE_PROSECUTION"]),
      responsibleUserId: z.string(),
      reserved: z.boolean(),
      withDefendant: z.boolean(),
      person: personChoiceSchema,
      stageCode: z.string(),
    })
    .superRefine((value, ctx) => {
      if (options.creating && options.requireResponsible && !value.responsibleUserId) {
        ctx.addIssue({
          code: "custom",
          path: ["responsibleUserId"],
          message: "Elegí quién es responsable de la causa: tiene que ser titular o abogado/a.",
        });
      }
      if (options.creating && value.withDefendant) {
        checkPersonChoice(value.person, ctx, ["person"]);
        if (!value.stageCode) {
          ctx.addIssue({ code: "custom", path: ["stageCode"], message: "Elegí la etapa." });
        }
      }
    });
}

export type CaseFormValues = z.output<ReturnType<typeof caseFormSchema>>;

/** Field names of the form that a server problem can point at. */
export const CASE_FORM_FIELDS = [
  "caption",
  "internalNumber",
  "mpfLegajo",
  "ofijuNumber",
  "pehuenNumber",
  "circumscriptionCode",
  "actionType",
  "represents",
  "responsibleUserId",
  "reserved",
] as const;
export type CaseFormField = (typeof CASE_FORM_FIELDS)[number];

export function caseFormDefaults(detail?: CaseDetail): CaseFormValues {
  return {
    caption: detail?.caption ?? "",
    internalNumber: detail?.internalNumber ?? "",
    mpfLegajo: detail?.mpfLegajo ?? "",
    ofijuNumber: detail?.ofijuNumber ?? "",
    pehuenNumber: detail?.pehuenNumber ?? "",
    circumscriptionCode: detail?.circumscriptionCode ?? "",
    actionType: detail?.actionType ?? "PUBLIC",
    represents: detail?.represents ?? "DEFENCE",
    responsibleUserId: "",
    reserved: detail?.reserved ?? false,
    withDefendant: false,
    person: EMPTY_PERSON_CHOICE,
    stageCode: FIRST_STAGE,
  };
}

const orNull = (value: string) => value || null;

/** The body of `POST /cases` or `PUT /cases/{id}`; the responsible only goes on creation. */
export function caseDataOf(values: CaseFormValues, creating: boolean): CaseData {
  const data: CaseData = {
    caption: values.caption,
    internalNumber: orNull(values.internalNumber),
    mpfLegajo: orNull(values.mpfLegajo),
    ofijuNumber: orNull(values.ofijuNumber),
    pehuenNumber: orNull(values.pehuenNumber),
    circumscriptionCode: values.circumscriptionCode,
    actionType: values.actionType,
    represents: values.represents,
    reserved: values.reserved,
  };
  if (creating) data.responsibleUserId = orNull(values.responsibleUserId);
  return data;
}

/** The defendant form, for adding (with the person) and for editing. */
export function defendantFormSchema(options: { adding: boolean; today: string }) {
  return z
    .object({
      person: personChoiceSchema,
      stageCode: z.string(),
      status: z.enum(["ACTIVE", "SUSPENDED", "IN_MEDIATION", "CLOSED"]),
      closingOutcomeCode: z.string(),
      chargesFormulatedOn: z.string(),
      defendedByFirm: z.boolean(),
      defenceCounselKind: z.enum(["PRIVATE", "PUBLIC"]),
      defenceCounselName: z
        .string()
        .trim()
        .max(COUNSEL_NAME_MAX, `Hasta ${COUNSEL_NAME_MAX} caracteres.`),
    })
    .superRefine((value, ctx) => {
      if (options.adding) checkPersonChoice(value.person, ctx, ["person"]);
      if (value.status === "CLOSED") {
        if (!value.closingOutcomeCode) {
          ctx.addIssue({
            code: "custom",
            path: ["closingOutcomeCode"],
            message: "Elegí cómo terminó el proceso.",
          });
        }
      } else if (!value.stageCode) {
        ctx.addIssue({ code: "custom", path: ["stageCode"], message: "Elegí la etapa." });
      }
      if (value.chargesFormulatedOn && value.chargesFormulatedOn > options.today) {
        ctx.addIssue({
          code: "custom",
          path: ["chargesFormulatedOn"],
          message: "La formulación de cargos no puede ser una fecha futura.",
        });
      }
    });
}

export type DefendantFormValues = z.output<ReturnType<typeof defendantFormSchema>>;

export const DEFENDANT_FORM_FIELDS = [
  "stageCode",
  "status",
  "closingOutcomeCode",
  "chargesFormulatedOn",
  "defendedByFirm",
  "defenceCounselKind",
  "defenceCounselName",
] as const;
export type DefendantFormField = (typeof DEFENDANT_FORM_FIELDS)[number];

export function defendantFormDefaults(defendant?: DefendantView): DefendantFormValues {
  return {
    person: EMPTY_PERSON_CHOICE,
    stageCode:
      defendant && defendant.stageCode !== CLOSED_STAGE ? defendant.stageCode : FIRST_STAGE,
    status: defendant?.status ?? "ACTIVE",
    closingOutcomeCode: defendant?.closingOutcomeCode ?? "",
    chargesFormulatedOn: defendant?.chargesFormulatedOn ?? "",
    defendedByFirm: defendant?.defendedByFirm ?? true,
    defenceCounselKind: defendant?.defenceCounselKind ?? "PRIVATE",
    defenceCounselName: defendant?.defenceCounselName ?? "",
  };
}

/**
 * The body of the defendant endpoints. A closed defendant is in the closed stage with an
 * outcome; the values the form does not show (rebellion, indigenous people) are sent back as
 * they are, because an update replaces everything.
 */
export function defendantDataOf(
  values: Omit<DefendantFormValues, "person">,
  current?: DefendantView,
): DefendantData {
  const closed = values.status === "CLOSED";
  return {
    stageCode: closed ? CLOSED_STAGE : values.stageCode,
    status: values.status,
    closingOutcomeCode: closed ? values.closingOutcomeCode : null,
    chargesFormulatedOn: values.chargesFormulatedOn || null,
    defendedByFirm: values.defendedByFirm,
    defenceCounselKind: values.defendedByFirm ? "PRIVATE" : values.defenceCounselKind,
    defenceCounselName: values.defenceCounselName || null,
    rebellionDeclaredOn: current?.rebellionDeclaredOn ?? null,
    rebellionLiftedOn: current?.rebellionLiftedOn ?? null,
    indigenousPeople: current?.indigenousPeople ?? null,
  };
}
