import type { CaseFormField, DefendantFormField } from "@/features/cases/case-form-schema";
import { CASE_FORM_FIELDS, DEFENDANT_FORM_FIELDS } from "@/features/cases/case-form-schema";
import { formProblem, type FormProblem, type ProblemRule } from "@/lib/form-errors";

/** The backend's case problems (CaseProblemHandler, CaseService), in the form's words. */
const CASE_RULES: ProblemRule<CaseFormField>[] = [
  {
    type: "case-duplicate-legajo",
    field: "mpfLegajo",
    message: "Ya hay otra causa con este legajo del MPF. Buscala en la lista de causas.",
  },
  {
    type: "case-duplicate-internal-number",
    field: "internalNumber",
    message: "Ya hay otra causa con este número interno. Usá otro.",
  },
  {
    type: "invalid-case-data",
    detail: /MPF legajo/i,
    field: "mpfLegajo",
    message: "Escribilo como figura en el legajo, por ejemplo MPFNQ 12345/2026.",
  },
  {
    type: "invalid-case-data",
    detail: /responsible/i,
    field: "responsibleUserId",
    message: "La persona responsable tiene que ser titular o abogado/a con la cuenta activa.",
  },
  {
    type: "invalid-case-data",
    detail: /circumscriptions/i,
    field: "circumscriptionCode",
    message: "Esa circunscripción ya no se ofrece en el estudio. Elegí otra.",
  },
  {
    type: "invalid-case-data",
    detail: /closing outcome|closed case/i,
    field: "caseOutcomeCode",
    message: "Una causa cerrada necesita cómo terminó; una abierta, no.",
  },
  {
    type: "invalid-case-data",
    detail: /catalog stages/i,
    field: "caseStageCode",
    message: "Esa etapa ya no se ofrece en el estudio. Elegí otra.",
  },
  {
    type: "invalid-case-data",
    detail: /catalog action-types/i,
    field: "actionType",
    message: "Ese tipo ya no se ofrece en este fuero. Elegí otro.",
  },
  {
    type: "practice-area-not-enabled",
    field: "practiceArea",
    message: "El estudio no trabaja en ese fuero. Elegí otro o habilitalo en Ajustes.",
  },
  {
    type: "module-not-enabled",
    message: "Este fuero no usa ese dato. Revisá los campos y volvé a guardar.",
  },
  {
    type: "access-denied",
    field: "reserved",
    message: "Solo la persona titular o quien es responsable de la causa cambian la reserva.",
  },
];

export function caseFormProblem(error: unknown): FormProblem<CaseFormField> {
  return formProblem(error, { subject: "la causa", rules: CASE_RULES, fields: CASE_FORM_FIELDS });
}

/** The person fields the person problems point at. */
export type PersonField = "documentNumber" | "lastNames";

const PERSON_RULES: ProblemRule<PersonField>[] = [
  {
    type: "person-duplicate-document",
    field: "documentNumber",
    message:
      "Ya hay una persona con este documento. Elegí «Ya está cargada» y buscala por el documento.",
  },
  {
    type: "invalid-person-data",
    detail: /document/i,
    field: "documentNumber",
    message: "Revisá el número: no coincide con el tipo de documento.",
  },
  {
    type: "invalid-person-data",
    detail: /last names/i,
    field: "lastNames",
    message: "Escribí el apellido.",
  },
];

export function personProblem(error: unknown): FormProblem<PersonField> {
  return formProblem(error, {
    subject: "a la persona",
    rules: PERSON_RULES,
    fields: ["documentNumber", "lastNames"],
  });
}

/** The defendant problems (Defendant.apply, DefendantService). */
const DEFENDANT_RULES: ProblemRule<DefendantFormField>[] = [
  {
    type: "duplicate-record",
    message: "Esa persona ya es imputada en esta causa. Editala desde su tarjeta.",
  },
  {
    type: "invalid-case-data",
    detail: /archived person/i,
    message: "La ficha de esa persona está archivada: hay que restaurarla antes de sumarla.",
  },
  {
    type: "invalid-case-data",
    detail: /closing outcome|closed defendant/i,
    field: "closingOutcomeCode",
    message: "Un proceso cerrado necesita cómo terminó; uno abierto, no.",
  },
  {
    type: "invalid-case-data",
    detail: /private counsel/i,
    field: "defenceCounselKind",
    message: "Si lo defiende el estudio, la defensa es particular.",
  },
  {
    type: "invalid-case-data",
    detail: /stages/i,
    field: "stageCode",
    message: "Esa etapa ya no se ofrece en el estudio. Elegí otra.",
  },
  {
    type: "invalid-case-data",
    detail: /closing-outcomes/i,
    field: "closingOutcomeCode",
    message: "Ese resultado ya no se ofrece en el estudio. Elegí otro.",
  },
];

export function defendantProblem(error: unknown): FormProblem<DefendantFormField> {
  return formProblem(error, {
    subject: "al imputado",
    rules: DEFENDANT_RULES,
    fields: DEFENDANT_FORM_FIELDS,
  });
}

/** The party problems (CasePartyService). */
const PARTY_RULES: ProblemRule<"roleCode">[] = [
  {
    type: "duplicate-record",
    message: "Esa persona ya tiene ese rol en la causa.",
  },
  {
    type: "invalid-case-data",
    detail: /archived person/i,
    message: "La ficha de esa persona está archivada: hay que restaurarla antes de sumarla.",
  },
  {
    type: "invalid-case-data",
    detail: /party-roles|defendant is not a party/i,
    field: "roleCode",
    message: "Ese rol no se ofrece en este fuero. Elegí otro.",
  },
];

export function partyProblem(error: unknown): FormProblem<"roleCode"> {
  return formProblem(error, { subject: "a la parte", rules: PARTY_RULES, fields: ["roleCode"] });
}
