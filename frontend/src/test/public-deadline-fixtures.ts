/*
 * Public deadline rules (a subset of jurisdictions/neuquen/penal/deadline-rules.yml, legal data)
 * and a small stand-in for the public calculator (ADR-0041), shared by the Vitest suite and the
 * Playwright mock backend. The court calendar here is a short fictitious subset of non-business
 * days, enough for the examples; 2028 is "not loaded" on purpose. Relative imports only: the e2e
 * project (tsconfig.node.json) has no "@/" alias.
 */
import {
  addDays,
  instantAt,
  isIsoDate,
  isLocalTime,
  localDay,
} from "../features/agenda/agenda-dates";
import type {
  PublicCalculation,
  PublicRule,
} from "../features/public-deadlines/public-deadline-types";

const LAW = "CPP de Neuquén (Ley 2784)";
const DISCLAIMER = "Cálculo asistido: verificá con la norma.";
const ZONE = "America/Argentina/Salta";

const rule = (
  overrides: Partial<PublicRule> & Pick<PublicRule, "code" | "name"> & { article: string },
): PublicRule => {
  const { article, ...rest } = overrides;
  return {
    source: `Art. ${article} · ${LAW}`,
    trigger: "Detención",
    computation: "HOURS",
    duration: 24,
    detainee: true,
    consequence: "Libertad",
    flags: [],
    note: null,
    disclaimer: DISCLAIMER,
    ...rest,
  };
};

export const PUBLIC_CONTROL = rule({
  code: "control-judicial-detencion",
  name: "Detención sin control judicial",
  article: "112; 49 inc. 5",
  flags: ["validar"],
  note: "Validar si se aprobó la ampliación a 48 h para narcomenudeo.",
});

export const PUBLIC_REVIEW = rule({
  code: "revision-prision-preventiva",
  name: "Audiencia de revisión de prisión preventiva",
  article: "118",
  trigger: "Pedido de la defensa",
  computation: "CALENDAR_DAYS",
  duration: 5,
  consequence: "Pronto despacho y, a las 24 h, libertad (art. 120)",
  flags: ["validar"],
});

export const PUBLIC_IMPUGNACION = rule({
  code: "impugnacion-ordinaria",
  name: "Impugnación ordinaria",
  article: "242",
  trigger: "Notificación de la decisión",
  computation: "BUSINESS_DAYS",
  duration: 5,
  detainee: false,
  consequence: "Caduca el derecho a impugnar",
  flags: ["validar", "no-verificado"],
  note: "El plazo se duplica en asuntos complejos (art. 224, no verificado); cargalo como prórroga.",
});

export const PUBLIC_INVESTIGATION = rule({
  code: "investigacion-preparatoria",
  name: "Duración de la investigación preparatoria",
  article: "158; 160 inc. 7",
  trigger: "Apertura de la investigación o formulación de cargos (validar desde cuándo)",
  computation: "MONTHS",
  duration: 4,
  detainee: false,
  consequence: "Extinción de la acción y sobreseimiento",
  flags: ["validar", "no-verificado"],
});

export const PUBLIC_RULES: PublicRule[] = [
  PUBLIC_CONTROL,
  PUBLIC_REVIEW,
  PUBLIC_IMPUGNACION,
  PUBLIC_INVESTIGATION,
];

export const CALENDAR_SOURCE =
  "Ley 27.399 (feriados nacionales) y acordadas del TSJ de Neuquén (ferias judiciales)";

/** Loaded years of the stand-in court calendar. */
const LOADED_YEARS = [2025, 2026, 2027];
const NON_BUSINESS_DAYS = new Set(["2026-11-23", "2026-12-07", "2026-12-08", "2026-12-25"]);

function isBusinessDay(day: string): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !NON_BUSINESS_DAYS.has(day);
}

function addMonths(day: string, months: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/** Day-based terms end at 24 h of their last day: the start of the next day in Neuquén. */
const endOfDay = (day: string) => instantAt(addDays(day, 1), "00:00", ZONE);

export interface PublicDeadlineAnswer {
  status: number;
  json?: unknown;
  problem?: string;
}

/** One calculation over the rules above; undefined when the path is not the calculator's. */
export function publicDeadlineBackend(rules: PublicRule[] = PUBLIC_RULES) {
  return (path: string, query: Record<string, string>): PublicDeadlineAnswer | undefined => {
    if (path === "/api/v1/public/deadline-rules") return { status: 200, json: rules };
    if (path !== "/api/v1/public/deadline-calculation") return undefined;

    const found = rules.find((candidate) => candidate.code === query.rule);
    if (!found) return { status: 404, problem: "deadline-rule-not-found" };
    const startDate = query.startDate ?? "";
    if (!isIsoDate(startDate)) return { status: 400, problem: "invalid-deadline-data" };
    const hours = found.computation === "HOURS";
    if (hours && !isLocalTime(query.startTime)) {
      return { status: 400, problem: "invalid-deadline-data" };
    }

    const base: PublicCalculation = {
      rule: found,
      startDate,
      startTime: hours ? `${query.startTime}:00` : null,
      outcome: "DUE",
      dueOn: null,
      dueAt: null,
      missingYear: null,
      calendarSource: null,
      calendarFlags: [],
      disclaimer: DISCLAIMER,
    };

    switch (found.computation) {
      case "HOURS": {
        const start = Date.parse(instantAt(startDate, query.startTime ?? "00:00", ZONE));
        const dueAt = new Date(start + found.duration * 3_600_000).toISOString();
        return { status: 200, json: { ...base, dueAt, dueOn: localDay(dueAt, ZONE) } };
      }
      case "BUSINESS_DAYS": {
        const calendar = { calendarSource: CALENDAR_SOURCE, calendarFlags: ["validar"] };
        let day = startDate;
        let counted = 0;
        while (counted < found.duration) {
          day = addDays(day, 1);
          const year = Number(day.slice(0, 4));
          if (!LOADED_YEARS.includes(year)) {
            return {
              status: 200,
              json: { ...base, ...calendar, outcome: "CALENDAR_NOT_LOADED", missingYear: year },
            };
          }
          if (isBusinessDay(day)) counted += 1;
        }
        return { status: 200, json: { ...base, ...calendar, dueOn: day, dueAt: endOfDay(day) } };
      }
      case "CALENDAR_DAYS": {
        const dueOn = addDays(startDate, found.duration);
        return { status: 200, json: { ...base, dueOn, dueAt: endOfDay(dueOn) } };
      }
      case "MONTHS":
      case "YEARS": {
        const months = found.computation === "YEARS" ? found.duration * 12 : found.duration;
        const dueOn = addMonths(startDate, months);
        return { status: 200, json: { ...base, dueOn, dueAt: endOfDay(dueOn) } };
      }
    }
  };
}
