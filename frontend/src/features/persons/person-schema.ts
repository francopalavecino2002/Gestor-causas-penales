import { z } from "zod";

import type { DocumentType, NewHumanPerson } from "@/features/persons/person-api";

// Same limits as the backend (PersonData, DocumentType).
export const NAME_MAX = 120;
export const DOCUMENT_MAX = 60;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  DNI: "DNI",
  PASSPORT: "Pasaporte",
  CUIT: "CUIT",
  CUIL: "CUIL",
  OTHER: "Otro",
};

/** The normalized shape the backend accepts for each document type. */
const DOCUMENT_SHAPES: Record<DocumentType, { pattern: RegExp; message: string }> = {
  DNI: { pattern: /^\d{7,8}$/, message: "El DNI tiene 7 u 8 números." },
  PASSPORT: { pattern: /^[A-Z0-9]{1,30}$/, message: "Usá solo letras y números (hasta 30)." },
  CUIT: { pattern: /^\d{11}$/, message: "El CUIT tiene 11 números." },
  CUIL: { pattern: /^\d{11}$/, message: "El CUIL tiene 11 números." },
  OTHER: { pattern: /^[A-Z0-9]{1,30}$/, message: "Usá solo letras y números (hasta 30)." },
};

/** Same as the backend's DocumentLookup.normalize: no separators, uppercase. */
export function normalizeDocument(number: string): string {
  return number.replace(/[\s.-]/g, "").toUpperCase();
}

/** Why a normalized number does not fit its document type, or null when it fits. */
export function documentShapeError(type: DocumentType, normalized: string): string | null {
  const shape = DOCUMENT_SHAPES[type];
  return shape.pattern.test(normalized) ? null : shape.message;
}

/**
 * Who the defendant is: a person already in the firm (`existing`, by id) or a new one typed in
 * the form (`new`). The new person is created right before the defendant.
 */
export const personChoiceSchema = z.object({
  mode: z.enum(["existing", "new"]),
  personId: z.string(),
  /** The chosen person's name, to show the choice; never sent. */
  personName: z.string(),
  firstNames: z.string().trim().max(NAME_MAX, `Hasta ${NAME_MAX} caracteres.`),
  lastNames: z.string().trim().max(NAME_MAX, `Hasta ${NAME_MAX} caracteres.`),
  documentType: z.enum(["DNI", "PASSPORT", "CUIT", "CUIL", "OTHER"]),
  documentNumber: z.string().trim().max(DOCUMENT_MAX, `Hasta ${DOCUMENT_MAX} caracteres.`),
});

export type PersonChoice = z.output<typeof personChoiceSchema>;

export const EMPTY_PERSON_CHOICE: PersonChoice = {
  mode: "existing",
  personId: "",
  personName: "",
  firstNames: "",
  lastNames: "",
  documentType: "DNI",
  documentNumber: "",
};

/** The checks that depend on the mode; `path` is where the choice sits in the form. */
export function checkPersonChoice(
  choice: PersonChoice,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  if (choice.mode === "existing") {
    if (!choice.personId) {
      ctx.addIssue({
        code: "custom",
        path: [...path, "personId"],
        message: "Elegí a la persona de la lista, o cargá una nueva.",
      });
    }
    return;
  }
  if (!choice.lastNames) {
    ctx.addIssue({ code: "custom", path: [...path, "lastNames"], message: "Escribí el apellido." });
  }
  const number = normalizeDocument(choice.documentNumber);
  const shapeError = number ? documentShapeError(choice.documentType, number) : null;
  if (shapeError) {
    ctx.addIssue({ code: "custom", path: [...path, "documentNumber"], message: shapeError });
  }
}

/** The person to create for a `new` choice. */
export function newPersonOf(choice: PersonChoice): NewHumanPerson {
  const number = normalizeDocument(choice.documentNumber);
  return {
    kind: "HUMAN",
    firstNames: choice.firstNames || null,
    lastNames: choice.lastNames,
    documentType: number ? choice.documentType : null,
    documentNumber: number || null,
  };
}
