import { formatDayLabel, formatTime, localDay } from "@/features/agenda/agenda-dates";
import type { IsoDate } from "@/features/agenda/agenda-types";
import type {
  CaseHearing,
  CaseStatus,
  CoerciveMeasure,
  DefendantStatus,
  DefendantView,
  TeamRole,
} from "@/features/cases/case-types";

export const DEFENDANT_STATUS_LABELS: Record<DefendantStatus, string> = {
  ACTIVE: "En trámite",
  SUSPENDED: "Proceso suspendido",
  IN_MEDIATION: "En mediación",
  CLOSED: "Cerrado",
};

/** A case of an area without defendants goes through the same states as a defendant. */
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = DEFENDANT_STATUS_LABELS;

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  RESPONSIBLE: "Responsable",
  COLLABORATOR: "Colaboración",
  PARALEGAL: "Procuración",
};

/** "1 imputado", "3 imputados". */
export function countDefendants(count: number): string {
  return `${count} ${count === 1 ? "imputado" : "imputados"}`;
}

/** "1 persona detenida", "2 personas detenidas". */
export function countDetainees(count: number): string {
  return count === 1 ? "1 persona detenida" : `${count} personas detenidas`;
}

/** "23/11/2026": a calendar day, short, as lawyers write it. */
export function formatNumericDate(day: IsoDate): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

/** "23/11/2026, 11:00" in the given zone: short enough for a table cell. */
export function formatShortDateTime(instant: string, timeZone: string): string {
  return `${formatNumericDate(localDay(instant, timeZone))}, ${formatTime(instant, timeZone)}`;
}

/** "Lunes 23 de noviembre de 2026, 11:00" in the given zone. */
export function formatLongDateTime(instant: string, timeZone: string): string {
  const day = formatDayLabel(localDay(instant, timeZone), { year: true });
  return `${day}, ${formatTime(instant, timeZone)}`;
}

/** Who defends the person: the firm, or the other counsel with its kind. */
export function defenceCounsel(defendant: DefendantView): string {
  if (defendant.defendedByFirm) return "El estudio";
  const kind =
    defendant.defenceCounselKind === "PUBLIC"
      ? "Defensa oficial"
      : defendant.defenceCounselKind === "PRIVATE"
        ? "Defensa particular"
        : null;
  const name = defendant.defenceCounselName?.trim();
  if (kind && name) return `${kind}: ${name}`;
  return kind ?? name ?? "Sin cargar";
}

/** Declared in rebellion and not lifted yet (CPP art. 52). */
export function isInRebellion(defendant: DefendantView): boolean {
  return defendant.rebellionDeclaredOn !== null && defendant.rebellionLiftedOn === null;
}

/** Codes of the liberty-situations catalog this screen can tell from the record. */
export type LibertySituation =
  | "profugo-o-rebelde"
  | "prision-preventiva"
  | "detencion-domiciliaria"
  | "en-libertad-con-medidas"
  | "en-libertad-sin-medidas";

/** Package names, used until the firm's catalog (which may rename them) loads. */
export const LIBERTY_SITUATION_FALLBACK: Record<LibertySituation, string> = {
  "profugo-o-rebelde": "Prófugo o rebelde",
  "prision-preventiva": "En prisión preventiva",
  "detencion-domiciliaria": "Detenido en domiciliaria",
  "en-libertad-con-medidas": "En libertad con medidas",
  "en-libertad-sin-medidas": "En libertad sin medidas",
};

/** The situations that deprive a person of liberty: shown in red, the only red in the product. */
export function isCustodial(situation: LibertySituation): boolean {
  return situation === "prision-preventiva" || situation === "detencion-domiciliaria";
}

/**
 * Statuses of a hearing that is over or will not take place: the backend never offers one as a
 * case's next hearing (`HearingRules.NOT_PENDING`).
 */
const NOT_PENDING = new Set(["cancelada", "suspendida", "efectiva", "reconvertida"]);
const CALLED_OFF = new Set(["cancelada", "suspendida"]);

/**
 * Upcoming = still pending and not started yet, the soonest first (the backend's rule for the
 * next hearing). A future hearing that was suspended or cancelled goes apart, so it never reads
 * as something to attend. Everything else is past, the most recent first.
 */
export function groupCaseHearings(hearings: CaseHearing[], now: Date) {
  const cutoff = now.getTime();
  const isFuture = (hearing: CaseHearing) => Date.parse(hearing.startsAt) >= cutoff;
  const ascending = (a: CaseHearing, b: CaseHearing) =>
    Date.parse(a.startsAt) - Date.parse(b.startsAt);
  const upcoming = hearings
    .filter((hearing) => isFuture(hearing) && !NOT_PENDING.has(hearing.statusCode))
    .sort(ascending);
  const called = hearings
    .filter((hearing) => isFuture(hearing) && CALLED_OFF.has(hearing.statusCode))
    .sort(ascending);
  const past = hearings
    .filter((hearing) => !upcoming.includes(hearing) && !called.includes(hearing))
    .sort((a, b) => ascending(b, a));
  return { upcoming, called, past };
}

/**
 * Measures in force on `today`: neither lifted nor archived, and already started. The same rule
 * the backend uses to count a case's detainees (`CoerciveMeasureRepository.countDetaineesByCase`).
 */
export function measuresInForce(measures: CoerciveMeasure[], today: IsoDate): CoerciveMeasure[] {
  return measures.filter((measure) => measure.active && measure.startsOn <= today);
}

/**
 * The defendant's liberty situation, computed from the record (the backend does not compute it
 * yet, ADR-0024) [validar]. Custodial measures in force come first, with the backend's rule for
 * the case's detainee count (every defendant listed in the case, whatever their status), so the
 * card and the summary always agree; then rebellion; then any other measure in force.
 * "Aprehendido" and "Condenado cumpliendo pena" cannot be told from these data and are not
 * guessed.
 */
export function libertySituation(
  defendant: DefendantView,
  measures: CoerciveMeasure[],
  today: IsoDate,
): LibertySituation {
  const inForce = measuresInForce(measures, today);
  if (inForce.some((measure) => measure.measureCode === "prision-preventiva")) {
    return "prision-preventiva";
  }
  if (inForce.some((measure) => measure.measureCode === "detencion-domiciliaria")) {
    return "detencion-domiciliaria";
  }
  if (isInRebellion(defendant)) return "profugo-o-rebelde";
  return inForce.length > 0 ? "en-libertad-con-medidas" : "en-libertad-sin-medidas";
}

/**
 * A custodial measure still in force for someone whose process is closed or suspended: likely a
 * measure nobody lifted in the system. The screen keeps it as detained (that is what the record
 * says, and what the case's count says) and asks the lawyer to check it.
 */
export function custodialMismatch(defendant: DefendantView, situation: LibertySituation): boolean {
  return (
    isCustodial(situation) && defendant.status !== "ACTIVE" && defendant.status !== "IN_MEDIATION"
  );
}
