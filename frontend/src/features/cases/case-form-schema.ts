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

/** What the case's area turns on, as far as the case form is concerned. */
export interface CaseFormArea {
  /** Defendants, each with their own course; without it the case has its own stage and status. */
  defendants: boolean;
  /** MPF legajo, OFIJU and Pehuén numbers (criminal procedure). */
  mpfLegajo: boolean;
}

/** The criminal area: what the form assumes until the firm's areas load. */
export const CRIMINAL_FORM_AREA: CaseFormArea = { defendants: true, mpfLegajo: true };

/**
 * The case form. `requireResponsible` is set when the signed-in user cannot be the responsible
 * (a paralegal or administrative member), so they have to pick one. `area` says which sections
 * apply: the first defendant (criminal) or the first party and the case's own course (others).
 */
export function caseFormSchema(options: {
  requireResponsible: boolean;
  creating: boolean;
  area?: CaseFormArea;
}) {
  const area = options.area ?? CRIMINAL_FORM_AREA;
  return z
    .object({
      practiceArea: z.string().min(1, "Elegí el fuero."),
      caption: z
        .string()
        .trim()
        .min(1, "Escribí la carátula.")
        .max(CAPTION_MAX, `La carátula tiene como máximo ${CAPTION_MAX} caracteres.`),
      internalNumber: optionalNumber,
      // Only shown, and so only filled in, when the area has the MPF legajo.
      mpfLegajo: optionalNumber.refine(
        (value) => value === "" || MPF_LEGAJO.test(value),
        "Escribilo como figura en el legajo, por ejemplo MPFNQ 12345/2026.",
      ),
      ofijuNumber: optionalNumber,
      pehuenNumber: optionalNumber,
      circumscriptionCode: z.string().min(1, "Elegí la circunscripción."),
      actionType: z.string().min(1, "Elegí el tipo."),
      represents: z.string().min(1, "Elegí a quién representa el estudio."),
      responsibleUserId: z.string(),
      reserved: z.boolean(),
      withDefendant: z.boolean(),
      person: personChoiceSchema,
      /** The first defendant's stage (criminal, on creation). */
      stageCode: z.string(),
      /** The case's own course (areas without defendants). */
      caseStageCode: z.string(),
      caseStatus: z.enum(["ACTIVE", "SUSPENDED", "IN_MEDIATION", "CLOSED"]),
      caseOutcomeCode: z.string(),
      /** The first party (areas without defendants, on creation). */
      withParty: z.boolean(),
      partyRoleCode: z.string(),
    })
    .superRefine((value, ctx) => {
      if (options.creating && options.requireResponsible && !value.responsibleUserId) {
        ctx.addIssue({
          code: "custom",
          path: ["responsibleUserId"],
          message: "Elegí quién es responsable de la causa: tiene que ser titular o abogado/a.",
        });
      }
      if (area.defendants) {
        if (options.creating && value.withDefendant) {
          checkPersonChoice(value.person, ctx, ["person"]);
          if (!value.stageCode) {
            ctx.addIssue({ code: "custom", path: ["stageCode"], message: "Elegí la etapa." });
          }
        }
        return;
      }
      if (value.caseStatus === "CLOSED") {
        if (!value.caseOutcomeCode) {
          ctx.addIssue({
            code: "custom",
            path: ["caseOutcomeCode"],
            message: "Elegí cómo terminó la causa.",
          });
        }
      } else if (!value.caseStageCode) {
        ctx.addIssue({ code: "custom", path: ["caseStageCode"], message: "Elegí la etapa." });
      }
      if (options.creating && value.withParty) {
        checkPersonChoice(value.person, ctx, ["person"]);
        if (!value.partyRoleCode) {
          ctx.addIssue({ code: "custom", path: ["partyRoleCode"], message: "Elegí el rol." });
        }
      }
    });
}

export type CaseFormValues = z.output<ReturnType<typeof caseFormSchema>>;

/** Field names of the form that a server problem can point at. */
export const CASE_FORM_FIELDS = [
  "practiceArea",
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
  "caseStageCode",
  "caseStatus",
  "caseOutcomeCode",
] as const;
export type CaseFormField = (typeof CASE_FORM_FIELDS)[number];

/**
 * The form's starting values: the case's, or a new one in `area`. The action type, the side and
 * the stages start empty for a new case: the form fills them with the first option of the area's
 * catalogs once they load.
 */
export function caseFormDefaults(detail?: CaseDetail, area: string = "penal"): CaseFormValues {
  return {
    practiceArea: detail?.practiceArea ?? area,
    caption: detail?.caption ?? "",
    internalNumber: detail?.internalNumber ?? "",
    mpfLegajo: detail?.mpfLegajo ?? "",
    ofijuNumber: detail?.ofijuNumber ?? "",
    pehuenNumber: detail?.pehuenNumber ?? "",
    circumscriptionCode: detail?.circumscriptionCode ?? "",
    actionType: detail?.actionType ?? "",
    represents: detail?.represents ?? "",
    responsibleUserId: "",
    reserved: detail?.reserved ?? false,
    withDefendant: false,
    person: EMPTY_PERSON_CHOICE,
    stageCode: FIRST_STAGE,
    caseStageCode: detail?.stageCode && detail.stageCode !== CLOSED_STAGE ? detail.stageCode : "",
    caseStatus: detail?.status ?? "ACTIVE",
    caseOutcomeCode: detail?.closingOutcomeCode ?? "",
    withParty: false,
    partyRoleCode: "",
  };
}

const orNull = (value: string) => value || null;

/**
 * The body of `POST /cases` or `PUT /cases/{id}`; the responsible and the area only go on
 * creation. The criminal numbers only go when the area has them, and the case's own course only
 * in an area without defendants (a closed case is in the closed stage with its outcome).
 */
export function caseDataOf(
  values: CaseFormValues,
  creating: boolean,
  area: CaseFormArea = CRIMINAL_FORM_AREA,
): CaseData {
  const data: CaseData = {
    caption: values.caption,
    internalNumber: orNull(values.internalNumber),
    mpfLegajo: area.mpfLegajo ? orNull(values.mpfLegajo) : null,
    ofijuNumber: area.mpfLegajo ? orNull(values.ofijuNumber) : null,
    pehuenNumber: area.mpfLegajo ? orNull(values.pehuenNumber) : null,
    circumscriptionCode: values.circumscriptionCode,
    actionType: values.actionType,
    represents: values.represents,
    reserved: values.reserved,
  };
  if (creating) {
    data.responsibleUserId = orNull(values.responsibleUserId);
    data.practiceArea = values.practiceArea;
  }
  if (!area.defendants) {
    const closed = values.caseStatus === "CLOSED";
    data.stageCode = closed ? CLOSED_STAGE : values.caseStageCode;
    data.status = values.caseStatus;
    data.closingOutcomeCode = closed ? values.caseOutcomeCode : null;
  }
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
