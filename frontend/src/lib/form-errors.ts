import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

/**
 * What a failed save means for a form: messages for specific fields (by the form's field names)
 * and, when the problem is not about one field, a general message for the form's Alert. Both
 * in Spanish, never the server's raw English text.
 */
export interface FormProblem<Field extends string> {
  fields: Partial<Record<Field, string>>;
  general?: string;
}

/** A per-field rule: which field a problem points at and what to tell the user. */
export interface ProblemRule<Field extends string> {
  /** Problem type, e.g. "case-duplicate-legajo". */
  type: string;
  /** Only when the problem's detail matches (the backend's English detail). */
  detail?: RegExp;
  field?: Field;
  message: string;
}

const FIELD_FALLBACK = "Revisá este dato.";

/**
 * Field errors some problem+json bodies list (`errors: [{ field | pointer | name, ... }]` or
 * `invalid-params: [{ name, reason }]`), by the API's field name. Empty when the body has none.
 */
function listedFields(problem: Record<string, unknown> | undefined): string[] {
  if (!problem) return [];
  const lists = [problem.errors, problem["invalid-params"]].filter(Array.isArray) as unknown[][];
  return lists.flat().flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const name = record.field ?? record.name ?? record.pointer;
    if (typeof name !== "string") return [];
    // "/caption" (JSON pointer) or "caption"; nested paths keep their first segment.
    const field = name.replace(/^#?\//, "").split(/[./[]/)[0];
    return field ? [field] : [];
  });
}

/** The general message for problems no rule covers: what happened and what to do. */
export function generalSaveMessage(error: unknown, subject: string): string {
  if (!isApiError(error)) return `No pudimos guardar ${subject}. Volvé a intentar en unos minutos.`;
  switch (error.type) {
    case NETWORK_ERROR:
      return `No hay conexión con el servidor, así que no se guardó ${subject}. Revisá tu conexión a internet y volvé a intentar.`;
    case CSRF_UNAVAILABLE:
      return "No pudimos validar la sesión. Recargá la página y volvé a intentar.";
    case "access-denied":
      return `No tenés permiso para guardar ${subject}. Pedíselo a la persona titular del estudio.`;
    case "archived-record":
      return "La causa está archivada: para cambiarla, primero hay que restaurarla.";
    case "not-found":
      return "Ya no encontramos la causa o algo que elegiste (puede que la hayan archivado o reservado). Recargá la página y volvé a intentar.";
    case "concurrent-change":
      return "Alguien del estudio cargó lo mismo al mismo tiempo. Recargá la página y revisá antes de volver a guardar.";
  }
  if (error.status === 400) return "Revisá los datos marcados y volvé a intentar.";
  return `El servidor no respondió como esperábamos y no se guardó ${subject}. Volvé a intentar en unos minutos.`;
}

/**
 * Maps a failed save onto the form: the first matching rule wins; field errors the body lists
 * are marked too. Whatever is left becomes the general message.
 */
export function formProblem<Field extends string>(
  error: unknown,
  options: { subject: string; rules: ProblemRule<Field>[]; fields: readonly Field[] },
): FormProblem<Field> {
  const result: FormProblem<Field> = { fields: {} };
  if (isApiError(error)) {
    const rule = options.rules.find(
      (candidate) =>
        candidate.type === error.type &&
        (!candidate.detail || candidate.detail.test(error.detail ?? "")),
    );
    if (rule) {
      if (rule.field) result.fields[rule.field] = rule.message;
      else result.general = rule.message;
      return result;
    }
    for (const name of listedFields(error.problem)) {
      const field = options.fields.find((candidate) => candidate === name);
      if (field) result.fields[field] = FIELD_FALLBACK;
    }
  }
  if (Object.keys(result.fields).length === 0) {
    result.general = generalSaveMessage(error, options.subject);
  }
  return result;
}
