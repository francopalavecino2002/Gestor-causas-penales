import { z } from "zod";

import { FIRM_TIME_ZONE, isIsoDate, todayIn } from "@/features/agenda/agenda-dates";
import type {
  ClientData,
  ClientView,
  ContactData,
  ContactView,
  DocumentType,
  PersonData,
  PersonRecord,
} from "@/features/persons/person-api";
import {
  documentShapeError,
  DOCUMENT_MAX,
  NAME_MAX,
  normalizeDocument,
} from "@/features/persons/person-schema";
import { isApiError } from "@/lib/api";
import { formProblem, type FormProblem } from "@/lib/form-errors";

// Same limits as the backend (PersonData, ClientData, ContactData).
export const LEGAL_NAME_MAX = 200;
export const ALIASES_MAX = 200;
export const NATIONALITY_MAX = 60;
export const PHONE_MAX = 40;
export const EMAIL_MAX = 200;
export const ADDRESS_MAX = 300;
export const REFERRAL_MAX = 200;
export const CONSENT_SCOPE_MAX = 500;
export const CONSENT_REF_MAX = 200;
export const CONTACT_NAME_MAX = 200;
export const RELATIONSHIP_MAX = 80;
export const MAY_BE_TOLD_MAX = 300;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (max: number) => z.string().trim().max(max, `Usá hasta ${max} caracteres.`);
const email = text(EMAIL_MAX).refine(
  (value) => value === "" || EMAIL.test(value),
  "Revisá el email: tiene que ser como nombre@ejemplo.com.",
);

/** Not after today in the firm's time zone; an empty value passes (optional dates). */
function notFuture(value: string): boolean {
  return value === "" || value <= todayIn(FIRM_TIME_ZONE);
}

const optionalDate = (future: string) =>
  z
    .string()
    .refine((value) => value === "" || isIsoDate(value), "Elegí una fecha válida o dejala vacía.")
    .refine(notFuture, future);

const nullable = (value: string): string | null => (value === "" ? null : value);

// ---------------------------------------------------------------- person

export const personFormSchema = z
  .object({
    kind: z.enum(["HUMAN", "LEGAL"]),
    lastNames: text(NAME_MAX),
    firstNames: text(NAME_MAX),
    legalName: text(LEGAL_NAME_MAX),
    aliases: text(ALIASES_MAX),
    /** "" is "Sin documento". */
    documentType: z.enum(["", "DNI", "PASSPORT", "CUIT", "CUIL", "OTHER"]),
    documentNumber: text(DOCUMENT_MAX),
    birthDate: optionalDate("La fecha de nacimiento no puede ser posterior a hoy."),
    nationality: text(NATIONALITY_MAX),
    phone: text(PHONE_MAX),
    email,
    address: text(ADDRESS_MAX),
  })
  .superRefine((values, ctx) => {
    if (values.kind === "HUMAN" && !values.lastNames) {
      ctx.addIssue({ code: "custom", path: ["lastNames"], message: "Escribí el apellido." });
    }
    if (values.kind === "LEGAL" && !values.legalName) {
      ctx.addIssue({
        code: "custom",
        path: ["legalName"],
        message: "Escribí la razón social o el nombre de la entidad.",
      });
    }
    const number = normalizeDocument(values.documentNumber);
    if (!number) return;
    if (values.documentType === "") {
      ctx.addIssue({
        code: "custom",
        path: ["documentType"],
        message: "Elegí el tipo de documento, o borrá el número.",
      });
      return;
    }
    const shapeError = documentShapeError(values.documentType, number);
    if (shapeError) ctx.addIssue({ code: "custom", path: ["documentNumber"], message: shapeError });
  });

export type PersonFormValues = z.output<typeof personFormSchema>;
export type PersonFormField = keyof PersonFormValues;

const PERSON_FIELDS: readonly PersonFormField[] = [
  "kind",
  "lastNames",
  "firstNames",
  "legalName",
  "aliases",
  "documentType",
  "documentNumber",
  "birthDate",
  "nationality",
  "phone",
  "email",
  "address",
];

export function personFormValues(person?: PersonRecord): PersonFormValues {
  return {
    kind: person?.kind ?? "HUMAN",
    lastNames: person?.lastNames ?? "",
    firstNames: person?.firstNames ?? "",
    legalName: person?.legalName ?? "",
    aliases: person?.aliases ?? "",
    documentType: person ? (person.documentType ?? "") : "DNI",
    documentNumber: person?.documentNumber ?? "",
    birthDate: person?.birthDate ?? "",
    nationality: person?.nationality ?? "",
    phone: person?.phone ?? "",
    email: person?.email ?? "",
    address: person?.address ?? "",
  };
}

/** The document the form would save, normalized; null when there is none. */
export function documentOf(
  values: Pick<PersonFormValues, "documentType" | "documentNumber">,
): { type: DocumentType; number: string } | null {
  const number = normalizeDocument(values.documentNumber);
  if (!number || values.documentType === "") return null;
  return { type: values.documentType, number };
}

/** The body of the save: what does not apply to the kind goes as null. */
export function personDataOf(values: PersonFormValues): PersonData {
  const human = values.kind === "HUMAN";
  const document = documentOf(values);
  return {
    kind: values.kind,
    firstNames: human ? nullable(values.firstNames) : null,
    lastNames: human ? nullable(values.lastNames) : null,
    legalName: human ? null : nullable(values.legalName),
    aliases: nullable(values.aliases),
    documentType: document?.type ?? null,
    documentNumber: document?.number ?? null,
    birthDate: human ? nullable(values.birthDate) : null,
    nationality: nullable(values.nationality),
    phone: nullable(values.phone),
    email: nullable(values.email),
    address: nullable(values.address),
  };
}

/** The person who already has the document, from a 409 `person-duplicate-document`. */
export function duplicatePersonId(error: unknown): string | null {
  if (!isApiError(error) || error.type !== "person-duplicate-document") return null;
  const id = error.problem?.existingPersonId;
  return typeof id === "string" ? id : null;
}

export function personProblem(error: unknown): FormProblem<PersonFormField> {
  return formProblem(error, {
    subject: "la persona",
    fields: PERSON_FIELDS,
    rules: [
      {
        type: "person-duplicate-document",
        field: "documentNumber",
        message: "Ya existe una persona con ese documento.",
      },
      {
        type: "invalid-person-data",
        detail: /document number does not look/i,
        field: "documentNumber",
        message: "El número no tiene la forma de ese tipo de documento.",
      },
      {
        type: "invalid-person-data",
        detail: /go together/i,
        field: "documentType",
        message: "Elegí el tipo de documento, o borrá el número.",
      },
      {
        type: "invalid-person-data",
        detail: /last names/i,
        field: "lastNames",
        message: "Escribí el apellido.",
      },
      {
        type: "invalid-person-data",
        detail: /legal name/i,
        field: "legalName",
        message: "Escribí la razón social o el nombre de la entidad.",
      },
      {
        type: "invalid-person-data",
        detail: /kind/i,
        message: "No se puede cambiar una persona humana a jurídica ni al revés.",
      },
      {
        type: "not-found",
        message: "Ya no encontramos a esta persona. Recargá la página y volvé a intentar.",
      },
    ],
  });
}

// ---------------------------------------------------------------- client

export const clientFormSchema = z
  .object({
    intakeDate: z
      .string()
      .refine(isIsoDate, "Elegí la fecha en que llegó al estudio.")
      .refine(notFuture, "La fecha de ingreso no puede ser posterior a hoy."),
    referralSource: text(REFERRAL_MAX),
    consentGivenOn: optionalDate("La fecha del consentimiento no puede ser posterior a hoy."),
    consentScope: text(CONSENT_SCOPE_MAX),
    consentDocumentRef: text(CONSENT_REF_MAX),
  })
  .superRefine((values, ctx) => {
    if (values.consentGivenOn && !values.consentScope) {
      ctx.addIssue({
        code: "custom",
        path: ["consentScope"],
        message: "Escribí para qué dio el consentimiento.",
      });
    }
    if (values.consentScope && !values.consentGivenOn) {
      ctx.addIssue({
        code: "custom",
        path: ["consentGivenOn"],
        message: "Elegí cuándo dio el consentimiento.",
      });
    }
  });

export type ClientFormValues = z.output<typeof clientFormSchema>;
export type ClientFormField = keyof ClientFormValues;

const CLIENT_FIELDS: readonly ClientFormField[] = [
  "intakeDate",
  "referralSource",
  "consentGivenOn",
  "consentScope",
  "consentDocumentRef",
];

export function clientFormValues(client?: ClientView): ClientFormValues {
  return {
    intakeDate: client?.intakeDate ?? todayIn(FIRM_TIME_ZONE),
    referralSource: client?.referralSource ?? "",
    consentGivenOn: client?.consentGivenOn ?? "",
    consentScope: client?.consentScope ?? "",
    consentDocumentRef: client?.consentDocumentRef ?? "",
  };
}

export function clientDataOf(values: ClientFormValues): ClientData {
  return {
    intakeDate: values.intakeDate,
    referralSource: nullable(values.referralSource),
    consentGivenOn: nullable(values.consentGivenOn),
    consentScope: nullable(values.consentScope),
    consentDocumentRef: nullable(values.consentDocumentRef),
  };
}

export function clientProblem(error: unknown): FormProblem<ClientFormField> {
  return formProblem(error, {
    subject: "los datos de cliente",
    fields: CLIENT_FIELDS,
    rules: [
      {
        type: "already-a-client",
        message:
          "Esta persona ya es cliente del estudio. Recargá la página para ver su ficha de cliente.",
      },
      {
        type: "invalid-person-data",
        detail: /consent/i,
        field: "consentScope",
        message: "La fecha y el alcance del consentimiento van juntos: completá los dos.",
      },
      {
        type: "not-found",
        message: "Ya no encontramos a esta persona. Recargá la página y volvé a intentar.",
      },
    ],
  });
}

// ---------------------------------------------------------------- contact

export const contactFormSchema = z.object({
  fullName: text(CONTACT_NAME_MAX).min(1, "Escribí el nombre del contacto."),
  relationship: text(RELATIONSHIP_MAX),
  phone: text(PHONE_MAX),
  email,
  mayBeTold: text(MAY_BE_TOLD_MAX).min(1, "Escribí qué se le puede informar."),
});

export type ContactFormValues = z.output<typeof contactFormSchema>;
export type ContactFormField = keyof ContactFormValues;

const CONTACT_FIELDS: readonly ContactFormField[] = [
  "fullName",
  "relationship",
  "phone",
  "email",
  "mayBeTold",
];

export function contactFormValues(contact?: ContactView): ContactFormValues {
  return {
    fullName: contact?.fullName ?? "",
    relationship: contact?.relationship ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    mayBeTold: contact?.mayBeTold ?? "",
  };
}

export function contactDataOf(values: ContactFormValues): ContactData {
  return {
    fullName: values.fullName,
    relationship: nullable(values.relationship),
    phone: nullable(values.phone),
    email: nullable(values.email),
    mayBeTold: values.mayBeTold,
  };
}

export function contactProblem(error: unknown): FormProblem<ContactFormField> {
  return formProblem(error, {
    subject: "el contacto",
    fields: CONTACT_FIELDS,
    rules: [
      {
        type: "invalid-person-data",
        field: "mayBeTold",
        message: "Escribí el nombre del contacto y qué se le puede informar.",
      },
      {
        type: "not-found",
        message: "Ya no encontramos a este cliente o contacto. Recargá la página.",
      },
    ],
  });
}
