// Relative imports: the e2e project (tsconfig.node.json) uses these types through the fixtures.
import type { IsoDate } from "../agenda/agenda-types";
import type { Computation, ReviewFlag } from "../deadlines/deadline-types";

/** The public calculator only offers terms the engine counts alone (no judge-set dates). */
export type PublicComputation = Exclude<Computation, "SET_BY_COURT">;

/** Backend `PublicRuleView` (ADR-0041): a built-in rule as the law says, without firm settings. */
export interface PublicRule {
  code: string;
  name: string;
  /** Article and law, ready to show: "Art. 242 · CPP de Neuquén (Ley 2784)". */
  source: string;
  /** What starts the term: "Notificación de la decisión". */
  trigger: string;
  computation: PublicComputation;
  /** In the unit of `computation`. */
  duration: number;
  /** The rule protects a person deprived of liberty. */
  detainee: boolean;
  consequence: string;
  flags: ReviewFlag[];
  note: string | null;
  disclaimer: string;
}

export type PublicOutcome = "DUE" | "CALENDAR_NOT_LOADED";

/** Backend `PublicCalculationView`: one calculation, nothing of it stored. */
export interface PublicCalculation {
  rule: PublicRule;
  startDate: IsoDate;
  /** `HH:mm` (or `HH:mm:ss`), only for terms in hours. */
  startTime: string | null;
  outcome: PublicOutcome;
  /** Last day of the term in Neuquén; null when the calendar is not loaded. */
  dueOn: IsoDate | null;
  /** Instant the term ends: the start of the next day for day-based terms. */
  dueAt: string | null;
  /** The year the court calendar lacks, for `CALENDAR_NOT_LOADED`. */
  missingYear: number | null;
  /** Where the court's non-business days come from, for business-day terms. */
  calendarSource: string | null;
  calendarFlags: ReviewFlag[];
  disclaimer: string;
}

export interface PublicCalculationRequest {
  rule: string;
  startDate: IsoDate;
  /** `HH:mm`, Neuquén time; sent only for terms in hours. */
  startTime?: string;
}
