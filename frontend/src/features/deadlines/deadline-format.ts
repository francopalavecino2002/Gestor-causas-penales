import { formatDayLabel, formatTime, localDay } from "@/features/agenda/agenda-dates";
import { formatNumericDate } from "@/features/cases/case-format";
import type {
  Computation,
  DeadlineExtension,
  DeadlineStatus,
  DeadlineView,
  ReviewFlag,
  RuleKind,
} from "@/features/deadlines/deadline-types";

/**
 * Most urgent first: what already ended, what ends within the rule's warning, what runs, then
 * what cannot be counted right now (stopped, or missing the court calendar) and what was done.
 */
export const GROUP_ORDER: DeadlineStatus[] = [
  "OVERDUE",
  "DUE_SOON",
  "RUNNING",
  "NOT_CALCULABLE",
  "SUSPENDED",
  "MET",
];

export const GROUP_TITLES: Record<DeadlineStatus, string> = {
  OVERDUE: "Vencidos",
  DUE_SOON: "Vencen pronto",
  RUNNING: "Próximos",
  NOT_CALCULABLE: "Sin calcular",
  SUSPENDED: "Suspendidos",
  MET: "Cumplidos",
};

/** The word on each card's status badge. */
export const STATUS_LABELS: Record<DeadlineStatus, string> = {
  OVERDUE: "Vencido",
  DUE_SOON: "Vence pronto",
  RUNNING: "En curso",
  NOT_CALCULABLE: "Sin calcular",
  SUSPENDED: "Suspendido",
  MET: "Cumplido",
};

/** Shown when the API sends no disclaimer: the system assists, the lawyer controls (rule 6). */
export const FALLBACK_DISCLAIMER = "Cálculo asistido: verificá con la norma.";

/** Already ended, or ends within the rule's warning window: amber, and it asks for action. */
export function isUrgent(status: DeadlineStatus): boolean {
  return status === "OVERDUE" || status === "DUE_SOON";
}

/** Lead-in before the due date: past for what ended or was done, future otherwise. */
export function dueLead(status: DeadlineStatus): string {
  if (status === "OVERDUE") return "Venció el ";
  if (status === "MET") return "Vencía el ";
  return "Vence el ";
}

export interface DeadlineGroup {
  status: DeadlineStatus;
  items: DeadlineView[];
}

/**
 * One group per status that has deadlines, in `GROUP_ORDER`. Inside each group the deadlines of
 * people deprived of liberty go first; otherwise the backend's order (soonest due date) is kept.
 */
export function groupDeadlines(deadlines: DeadlineView[]): DeadlineGroup[] {
  return GROUP_ORDER.map((status) => {
    const items = deadlines.filter((deadline) => deadline.status === status);
    return {
      status,
      items: [
        ...items.filter((deadline) => deadline.rule.detainee),
        ...items.filter((deadline) => !deadline.rule.detainee),
      ],
    };
  }).filter((group) => group.items.length > 0);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "1 plazo", "5 plazos". */
export function countDeadlines(count: number): string {
  return plural(count, "plazo", "plazos");
}

export const KIND_LABELS: Record<RuleKind, string> = {
  LEGAL: "Plazo legal",
  JUDICIAL: "Plazo judicial",
};

/** How the term is counted, in plain words: "24 horas corridas", "5 días hábiles". */
export function computationLabel(computation: Computation, amount: number | null): string {
  if (computation === "SET_BY_COURT") return "Fecha que fijó el juez o la fiscalía";
  if (amount === null) {
    const units: Record<Exclude<Computation, "SET_BY_COURT">, string> = {
      HOURS: "En horas corridas",
      BUSINESS_DAYS: "En días hábiles",
      CALENDAR_DAYS: "En días corridos",
      MONTHS: "En meses",
      YEARS: "En años",
    };
    return units[computation];
  }
  switch (computation) {
    case "HOURS":
      return plural(amount, "hora corrida", "horas corridas");
    case "BUSINESS_DAYS":
      return plural(amount, "día hábil", "días hábiles");
    case "CALENDAR_DAYS":
      return plural(amount, "día corrido", "días corridos");
    case "MONTHS":
      return plural(amount, "mes", "meses");
    case "YEARS":
      return plural(amount, "año", "años");
  }
}

/** The tag as the domain docs write it, kept visible next to the source. */
export const FLAG_LABELS: Record<ReviewFlag, string> = {
  validar: "[validar]",
  "no-verificado": "[no verificado]",
};

/** Hour-based terms end at an instant; the rest at 24 h of their last day. */
export function isHourBased(deadline: DeadlineView): boolean {
  return deadline.rule.computation === "HOURS";
}

/**
 * When it ends, in the firm's zone: "Martes 24 de noviembre de 2026, 02:00" for an hour-based
 * term, "Martes 24 de noviembre de 2026" for the rest. Null when there is no due date.
 */
export function dueLabel(deadline: DeadlineView, timeZone: string): string | null {
  if (isHourBased(deadline) && deadline.dueAt) {
    const day = formatDayLabel(localDay(deadline.dueAt, timeZone), { year: true });
    return `${day}, ${formatTime(deadline.dueAt, timeZone)}`;
  }
  return deadline.dueOn ? formatDayLabel(deadline.dueOn, { year: true }) : null;
}

/** When it started to run: "20/11/2026", or "23/11/2026, 02:00" for an hour-based term. */
export function triggeredLabel(deadline: DeadlineView, timeZone: string): string {
  if (isHourBased(deadline) && deadline.triggeredAt) {
    const day = formatNumericDate(localDay(deadline.triggeredAt, timeZone));
    return `${day}, ${formatTime(deadline.triggeredAt, timeZone)}`;
  }
  return formatNumericDate(deadline.triggeredOn);
}

/** Below this many hours an hour-based term counts in hours; above, in days. */
const HOURS_UNTIL_DAYS = 48;

function hoursText(hours: number): string {
  if (hours < 1) return "menos de una hora";
  return plural(hours, "hora", "horas");
}

/**
 * How far the due date is, from the backend's `daysLeft` and `hoursLeft`: "Quedan 15 horas",
 * "Vence hoy", "Quedan 6 días", "Venció ayer", "Venció hace 3 días". Hour-based terms count in
 * hours for their last two days. Null when the status has no due date to count to.
 */
export function remainingLabel(deadline: DeadlineView): string | null {
  const { status, daysLeft, hoursLeft } = deadline;
  if (status !== "OVERDUE" && status !== "DUE_SOON" && status !== "RUNNING") return null;
  if (daysLeft === null || hoursLeft === null) return null;

  if (status === "OVERDUE") {
    const hoursAgo = -hoursLeft;
    if (isHourBased(deadline) && hoursAgo < HOURS_UNTIL_DAYS) {
      return `Venció hace ${hoursText(hoursAgo)}`;
    }
    const daysAgo = -daysLeft;
    if (daysAgo <= 0) return `Venció hace ${hoursText(hoursAgo)}`;
    if (daysAgo === 1) return "Venció ayer";
    return `Venció hace ${daysAgo} días`;
  }

  if (isHourBased(deadline) && hoursLeft < HOURS_UNTIL_DAYS) {
    if (hoursLeft < 1) return "Queda menos de una hora";
    return hoursLeft === 1 ? "Queda 1 hora" : `Quedan ${hoursLeft} horas`;
  }
  if (daysLeft <= 0) return "Vence hoy";
  if (daysLeft === 1) return "Vence mañana";
  return `Quedan ${daysLeft} días`;
}

/** "1 prórroga concedida", "2 prórrogas concedidas". */
export function extensionsLabel(extensions: DeadlineExtension[]): string {
  return extensions.length === 1
    ? "1 prórroga concedida"
    : `${extensions.length} prórrogas concedidas`;
}

/** "Juez de garantías, 4 meses, el 20/07/2026": one extension, as a list item. */
export function extensionDetail(extension: DeadlineExtension, computation: Computation): string {
  const who = extension.grantedBy ?? `Prórroga ${extension.step}`;
  const amount = computationLabel(computation, extension.amount);
  return `${who}: ${amount}, concedida el ${formatNumericDate(extension.grantedOn)}`;
}

/** "Las suspensiones sumaron 3 días al plazo." */
export function suspendedDaysLabel(days: number): string {
  return `Las suspensiones sumaron ${plural(days, "día", "días")} al plazo.`;
}

/** Why a deadline has no date: the court calendar of its year is not loaded. */
export function notCalculableText(missingYear: number | null): string {
  const calendar = missingYear
    ? `el calendario judicial de ${missingYear}`
    : "el calendario judicial del período";
  return `Todavía no está cargado ${calendar} (feriados y días inhábiles), así que no podemos contar este plazo. Contalo a mano con la norma hasta que se cargue.`;
}

/** The line under the title: "Tenés 5 plazos para atender en los próximos 30 días, 2 de personas detenidas." */
export function deadlinesSummary(options: {
  count: number;
  detained: number;
  days: number;
  onlyDetained: boolean;
}): string {
  const { count, detained, days, onlyDetained } = options;
  const within = `en los próximos ${days} días`;
  if (onlyDetained) {
    return count === 0
      ? `No hay plazos de personas detenidas ${within}.`
      : `Tenés ${countDeadlines(count)} de personas detenidas para atender ${within}.`;
  }
  if (count === 0) return `No hay plazos ${within}.`;
  const main = `Tenés ${countDeadlines(count)} para atender ${within}`;
  if (detained === 0) return `${main}.`;
  return `${main}, ${detained} de ${detained === 1 ? "una persona detenida" : "personas detenidas"}.`;
}
