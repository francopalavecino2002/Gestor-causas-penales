import { FIELD_LABEL_MAX, FIELD_OPTIONS_MAX } from "@/features/settings/custom-field-schema";
import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

/** The backend's English details for an invalid custom field, in the screen's words. */
const CUSTOM_FIELD_DETAILS: [RegExp, string][] = [
  [/cannot be removed/i, "Una opción no se puede borrar: ocultala."],
  [/at least one visible option/i, "Una lista necesita al menos una opción visible."],
  [/at most \d+ options/i, `Una lista tiene como máximo ${FIELD_OPTIONS_MAX} opciones.`],
  [/at most \d+ characters/i, `Cada nombre tiene como máximo ${FIELD_LABEL_MAX} caracteres.`],
  [/needs a label/i, "Escribí un nombre."],
];

/**
 * What a failed settings change means for the user, from the problem+json answer: what happened
 * and what to do, in Spanish. Never the server's raw text.
 */
export function settingsErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return "No pudimos guardar el cambio. Volvé a intentar en unos minutos.";
  }
  switch (error.type) {
    case NETWORK_ERROR:
      return "No hay conexión con el servidor. Revisá tu conexión a internet y volvé a intentar.";
    case CSRF_UNAVAILABLE:
      return "No pudimos validar la sesión. Recargá la página y volvé a intentar.";
    case "access-denied":
      return "Solo la persona titular del estudio puede hacer este cambio.";
    case "catalog-change-not-allowed":
      return "Este catálogo no permite ese cambio: sus ítems los fija la norma o el sistema los usa para calcular.";
    case "invalid-catalog-change":
      return "Revisá el nombre: no puede quedar vacío.";
    case "catalog-item-not-found":
    case "custom-field-not-found":
    case "not-found":
      return "Ya no encontramos lo que querías cambiar. Recargá la página para ver la lista actual.";
    case "catalog-concurrent-change":
    case "custom-field-concurrent-change":
      return "Alguien del estudio cambió lo mismo al mismo tiempo. Recargá la página y volvé a intentar.";
    case "invalid-custom-field": {
      const known = CUSTOM_FIELD_DETAILS.find(([pattern]) => pattern.test(error.detail ?? ""));
      return known?.[1] ?? "Revisá los datos del campo y volvé a intentar.";
    }
  }
  if (error.status === 400) return "Revisá los datos y volvé a intentar.";
  return "El servidor no respondió como esperábamos. Volvé a intentar en unos minutos.";
}
