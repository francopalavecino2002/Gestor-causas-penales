import { formatShortDayLabel } from "@/features/agenda/agenda-dates";
import type { DetaineeAlert, NamedRef } from "@/features/agenda/agenda-types";

/** "CPP art. 118", "CPP arts. 167 a 169"; null when the type has no article ("Otra"). */
export function cppArticle(article: string | null | undefined): string | null {
  const text = article?.trim();
  if (!text) return null;
  const several = /\d\s*(?:,|\by\b|\ba\b)\s*\d/.test(text);
  return `CPP ${several ? "arts." : "art."} ${text}`;
}

/** "1 audiencia", "3 audiencias". */
export function countHearings(count: number): string {
  return `${count} ${count === 1 ? "audiencia" : "audiencias"}`;
}

/** When the agenda on screen happens, as it reads in a sentence. */
export type AgendaScope = "hoy" | "mañana" | "ese día" | "esta semana" | "esa semana";

/**
 * The line under the title: "Hoy tenés 5 audiencias, 1 con una persona detenida." In second
 * person for the whole firm or the user's own; in third person for a colleague ("Paula Demo
 * tiene 2 audiencias hoy.").
 */
export function agendaSummary(options: {
  count: number;
  detained: number;
  scope: AgendaScope;
  /** Set when the agenda is filtered by another lawyer. */
  lawyerName?: string;
}): string {
  const { count, detained, scope, lawyerName } = options;
  const main = lawyerName
    ? `${lawyerName} tiene ${countHearings(count)} ${scope}`
    : `${scope.charAt(0).toLocaleUpperCase("es-AR")}${scope.slice(1)} tenés ${countHearings(count)}`;
  if (detained === 0) return `${main}.`;
  const people = detained === 1 ? "una persona detenida" : "personas detenidas";
  return `${main}, ${detained} con ${people}.`;
}

/** "Martín Ficticio", "Diego Ejemplar y Nora Ficticia", "A, B y C". */
export function joinNames(people: NamedRef[]): string {
  const names = people.map((person) => person.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

export interface LawyerOption {
  /** User id; "" means the whole firm. */
  value: string;
  label: string;
}

/**
 * Options of the lawyer filter: the whole firm, the signed-in user, then every other lawyer seen
 * in the agenda by name. A lawyer picked from a shared link that we have not seen yet keeps a
 * generic label so the select never shows a value it does not have. Without a user id (session
 * still loading) there is no "Mis audiencias".
 */
export function lawyerOptions(
  meId: string | undefined,
  seen: NamedRef[],
  selected: string | undefined,
): LawyerOption[] {
  const others = new Map<string, string>();
  for (const lawyer of seen) if (lawyer.id !== meId) others.set(lawyer.id, lawyer.name);
  const options: LawyerOption[] = [
    { value: "", label: "Todo el estudio" },
    ...(meId ? [{ value: meId, label: "Mis audiencias" }] : []),
    ...[...others]
      .sort(([, a], [, b]) => a.localeCompare(b, "es-AR"))
      .map(([value, label]) => ({ value, label })),
  ];
  if (selected && !options.some((option) => option.value === selected)) {
    options.push({ value: selected, label: "Otro abogado o abogada" });
  }
  return options;
}

/** "hoy", "mañana", "el viernes 27/11 (en 4 días)", "ayer", "el viernes 20/11 (hace 3 días)". */
function relativeDay(dueOn: string, daysLeft: number): string {
  if (daysLeft === 0) return "hoy";
  if (daysLeft === 1) return "mañana";
  if (daysLeft === -1) return "ayer";
  const label = formatShortDayLabel(dueOn);
  return daysLeft > 0
    ? `el ${label} (en ${daysLeft} días)`
    : `el ${label} (hace ${-daysLeft} días)`;
}

/**
 * What a detainee alert says, as one sentence: the fact first, then what to do when there is
 * something to load. The defendant's name goes apart, as the alert's title.
 */
export function detaineeAlertSentence(alert: DetaineeAlert): string {
  if (alert.kind === "NO_DURATION" || alert.dueOn === null || alert.daysLeft === null) {
    return "La prisión preventiva no tiene fecha de fin cargada. Cargala en el caso.";
  }
  const when = relativeDay(alert.dueOn, alert.daysLeft);
  const past = alert.daysLeft < 0;
  switch (alert.kind) {
    case "ENDS":
      return `La medida de coerción ${past ? "venció" : "vence"} ${when}.`;
    case "REVIEW":
      return past
        ? `La revisión de la medida venció ${when}.`
        : `La revisión de la medida es ${when}.`;
    case "MAX_DURATION":
      return `${past ? "Cumplió" : "Cumple"} un año en prisión preventiva ${when}.`;
  }
}
