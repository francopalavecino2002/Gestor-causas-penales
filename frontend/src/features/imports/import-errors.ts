import type { ImportReport } from "@/features/imports/import-types";
import { CSRF_UNAVAILABLE, isApiError, NETWORK_ERROR } from "@/lib/api";

export interface ImportProblem {
  /** What happened. */
  title: string;
  /** What to do. */
  message: string;
  /** Header names the server pointed at (unknown, repeated or missing columns). */
  headers: string[];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** True when the server refused the import because of the user's role. */
export function isImportForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.type === "access-denied";
}

/** The report a failed commit sends back (`422 import-has-errors`), if any. */
export function reportOfFailedCommit(error: unknown): ImportReport | undefined {
  if (!isApiError(error) || error.type !== "import-has-errors") return undefined;
  const report = error.problem?.report;
  const looksLikeReport =
    report !== null &&
    typeof report === "object" &&
    Array.isArray((report as { rows?: unknown }).rows);
  return looksLikeReport ? (report as ImportReport) : undefined;
}

/**
 * What a failed upload means for the user, from the problem+json answer. The invalid-file details
 * are written in Spanish for users by the backend (ADR-0019), so they are shown as they come;
 * every other answer gets the screen's own words.
 */
export function importProblem(error: unknown): ImportProblem {
  const base = { headers: [] as string[] };
  if (!isApiError(error)) {
    return {
      ...base,
      title: "No pudimos revisar la planilla",
      message: "Volvé a intentar en unos minutos.",
    };
  }
  switch (error.type) {
    case "import-invalid-file":
      return {
        title: "No pudimos leer la planilla",
        message:
          error.detail ??
          "Revisá que sea un .csv o .xlsx con los encabezados de la plantilla y volvé a subirlo.",
        headers: stringList(error.problem?.headers),
      };
    case "import-has-errors":
      return {
        ...base,
        title: "No se guardó nada: hay filas con errores",
        message:
          "Al importar aparecieron filas con errores (puede que alguien haya cargado algo mientras revisabas). Corregilas en la planilla y subila de nuevo.",
      };
    case "concurrent-change":
      return {
        ...base,
        title: "No se guardó nada: hubo un cambio al mismo tiempo",
        message:
          "Alguien del estudio cargó un dato igual mientras se importaba la planilla. Revisala de nuevo antes de confirmar.",
      };
    case "access-denied":
      return {
        ...base,
        title: "No tenés permiso para importar",
        message: "Solo la persona titular y los abogados del estudio pueden importar planillas.",
      };
    case NETWORK_ERROR:
      return {
        ...base,
        title: "No hay conexión con el servidor",
        message: "Revisá tu conexión a internet y volvé a intentar. No se guardó nada.",
      };
    case CSRF_UNAVAILABLE:
      return {
        ...base,
        title: "No pudimos validar la sesión",
        message: "Recargá la página y volvé a intentar. No se guardó nada.",
      };
  }
  return {
    ...base,
    title: "El servidor no respondió como esperábamos",
    message: "Volvé a intentar en unos minutos. No se guardó nada.",
  };
}
