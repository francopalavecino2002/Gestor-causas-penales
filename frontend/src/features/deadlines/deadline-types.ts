// Relative import: the e2e project (tsconfig.node.json) uses these types through the fixtures.
import type { IsoDate } from "../agenda/agenda-types";

/** Backend `DeadlineStatus` (ADR-0017): where a deadline stands right now. */
export type DeadlineStatus =
  "MET" | "SUSPENDED" | "NOT_CALCULABLE" | "OVERDUE" | "DUE_SOON" | "RUNNING";

/** Backend `Computation`: how the rule counts its term (CPP art. 79). */
export type Computation =
  "HOURS" | "BUSINESS_DAYS" | "CALENDAR_DAYS" | "MONTHS" | "YEARS" | "SET_BY_COURT";

/** Set by the law, or by a judge or prosecutor in a resolution. */
export type RuleKind = "LEGAL" | "JUDICIAL";

/** Review tags kept visible next to the rule: an assumption, or a source not read in the code. */
export type ReviewFlag = "validar" | "no-verificado";

/** What the screen shows of the rule next to each due date (backend `DeadlineView.RuleRef`). */
export interface DeadlineRuleRef {
  code: string;
  name: string;
  /** Article and law, ready to show: "Art. 118 · CPP de Neuquén (Ley 2784)". */
  source: string;
  kind: RuleKind;
  computation: Computation;
  /** The rule protects a person deprived of liberty. */
  detainee: boolean;
  /** What happens when the term ends: "Libertad", "Caduca el derecho a impugnar". */
  consequence: string;
  caseLawStatus: string | null;
  caseLawUrl: string | null;
  flags: ReviewFlag[];
  /** False when the firm disabled the rule (only the case's list can show such a deadline). */
  enabled: boolean;
}

export interface DeadlineExtension {
  id: string;
  /** 1 for the first extension granted, 2 for the second... */
  step: number;
  grantedBy: string | null;
  amount: number;
  grantedOn: IsoDate;
  grantedByHearingId: string | null;
  notes: string | null;
}

/** Backend `DeadlineView`: a deadline with its computed due date and the disclaimer. */
export interface DeadlineView {
  id: string;
  caseId: string;
  caseCaption: string;
  defendantId: string | null;
  defendantName: string | null;
  rule: DeadlineRuleRef;
  triggeredOn: IsoDate;
  triggeredAt: string | null;
  setDueOn: IsoDate | null;
  hearingId: string | null;
  /** The rule's duration plus the extensions, in the unit of the computation; null if judicial. */
  amount: number | null;
  /** Last day of the term; null when suspended or not calculable. */
  dueOn: IsoDate | null;
  /** Instant the term ends; null when suspended or not calculable. */
  dueAt: string | null;
  status: DeadlineStatus;
  /** Calendar days from today to `dueOn`, negative when overdue. */
  daysLeft: number | null;
  /** Whole hours from now to `dueAt`, negative when overdue. */
  hoursLeft: number | null;
  /** Calendar days the suspensions added to the term. */
  suspendedDays: number;
  /** The year the court calendar lacks, when `NOT_CALCULABLE`. */
  missingYear: number | null;
  extensions: DeadlineExtension[];
  metOn: IsoDate | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  /** "Cálculo asistido: verificá con la norma." */
  disclaimer: string;
}
