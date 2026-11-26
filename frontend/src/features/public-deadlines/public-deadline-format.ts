import {
  FIRM_TIME_ZONE,
  formatDayLabel,
  formatTime,
  localDay,
} from "@/features/agenda/agenda-dates";
import { formatNumericDate } from "@/features/cases/case-format";
import { reviewTags } from "@/features/catalogs/catalog-format";
import type {
  PublicCalculation,
  PublicRule,
} from "@/features/public-deadlines/public-deadline-types";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

/** The public calculator's address: linked from the login, so it is the marketing entry point. */
export const PUBLIC_CALCULATOR_PATH = "/calculadora-de-plazos";

/** The problem type of the backend's rate limit (`/problems/public-calculator-throttled`). */
export const THROTTLED = "public-calculator-throttled";

export const THROTTLED_MESSAGE =
  "Hiciste muchas consultas seguidas. Esperá un momento y probá de nuevo.";

/** "Art. 242" out of "Art. 242 · CPP de Neuquén (Ley 2784)": the law is the same for every rule. */
export function articleOf(source: string): string {
  return source.split(" · ")[0]?.trim() || source;
}

/** What the rule's `<option>` says: "Impugnación ordinaria (Art. 242) [validar] [no verificado]". */
export function ruleOptionLabel(rule: PublicRule): string {
  return [rule.name, `(${articleOf(rule.source)})`, reviewTags(rule.flags)]
    .filter(Boolean)
    .join(" ");
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase("es-AR") + text.slice(1);
}

/** `HH:mm` out of the API's `HH:mm` or `HH:mm:ss`. */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

export interface DueParts {
  /** "Lunes 30 de noviembre de 2026". */
  day: string;
  /** "30/11/2026". */
  numericDay: string;
  /** "a las 24 h" for day-based terms, "a las 10:30" for terms in hours. */
  time: string;
}

/**
 * When the term ends, in Neuquén: day-based terms run until 24 h of `dueOn`; terms in hours end
 * at `dueAt` exactly. Null when there is no due date (the court calendar is not loaded).
 */
export function dueParts(calculation: PublicCalculation): DueParts | null {
  if (calculation.outcome !== "DUE") return null;
  if (calculation.rule.computation === "HOURS" && calculation.dueAt) {
    const day = localDay(calculation.dueAt, FIRM_TIME_ZONE);
    return {
      day: formatDayLabel(day, { year: true }),
      numericDay: formatNumericDate(day),
      time: `a las ${formatTime(calculation.dueAt, FIRM_TIME_ZONE)}`,
    };
  }
  if (!calculation.dueOn) return null;
  return {
    day: formatDayLabel(calculation.dueOn, { year: true }),
    numericDay: formatNumericDate(calculation.dueOn),
    time: "a las 24 h",
  };
}

/** "Vence el lunes 30 de noviembre de 2026 a las 24 h.": what the live region announces. */
export function dueSentence(calculation: PublicCalculation): string {
  const due = dueParts(calculation);
  if (!due) return notLoadedTitle(calculation.missingYear);
  return `Vence el ${lowerFirst(due.day)} ${due.time}.`;
}

/** "20/11/2026", or "20/11/2026, 10:30" for a term in hours. */
export function startLabel(calculation: PublicCalculation): string {
  const day = formatNumericDate(calculation.startDate);
  return calculation.startTime ? `${day}, ${shortTime(calculation.startTime)}` : day;
}

export function notLoadedTitle(missingYear: number | null): string {
  const calendar = missingYear
    ? `el calendario judicial de ${missingYear}`
    : "el calendario judicial de ese período";
  return `No se puede calcular: ${calendar} todavía no está cargado`;
}

/** What went wrong with a calculation, and what to do. */
export function calculationErrorMessage(error: unknown): string {
  if (isApiError(error) && error.type === THROTTLED) return throttledMessage(error.retryAfter);
  if (isApiError(error) && error.type === NETWORK_ERROR) {
    return "No hay conexión con el servidor, así que no pudimos calcular. Revisá tu conexión a internet y volvé a intentar.";
  }
  if (isApiError(error) && error.status === 404) {
    return "Ese plazo ya no está en la lista. Recargá la página y elegí otro.";
  }
  if (isApiError(error) && error.status === 400) {
    return "Revisá la fecha y la hora: el servidor no las pudo usar para calcular este plazo.";
  }
  return "El servidor no respondió como esperábamos y no pudimos calcular. Volvé a intentar en unos minutos.";
}

function throttledMessage(retryAfter: number | undefined): string {
  if (!retryAfter) return THROTTLED_MESSAGE;
  const wait = retryAfter === 1 ? "1 segundo" : `${retryAfter} segundos`;
  return `${THROTTLED_MESSAGE} Podés volver a calcular en ${wait}.`;
}
