// Relative imports: the e2e project (tsconfig.node.json) uses these types through the fixtures.
import type { ReviewFlag } from "../catalogs/catalog-types";
import type { Computation, RuleKind } from "../deadlines/deadline-types";

/** The records a firm can add fields to (backend `CustomFieldEntity`). */
export type CustomFieldEntity = "CASE_FILE" | "DEFENDANT";

/** What a field holds (backend `CustomFieldType`). Only LIST has options. */
export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "LIST";

export interface CustomFieldOption {
  code: string;
  label: string;
  /** Not offered for new values; the values already stored keep it. */
  hidden: boolean;
}

/** Backend `CustomFieldView`. */
export interface CustomField {
  id: string;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  position: number;
  options: CustomFieldOption[];
  archived: boolean;
  createdAt: string;
}

/** `POST /api/v1/custom-fields`. */
export interface NewCustomField {
  entity: CustomFieldEntity;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: { label: string }[];
}

/** `PUT /api/v1/custom-fields/{id}`: a full replace of what can change. No code: a new option. */
export interface CustomFieldChange {
  label: string;
  required: boolean;
  position: number;
  options: { code?: string; label: string; hidden: boolean }[];
}

/** Whom a deadline runs for (backend `RuleScope`). */
export type RuleScope = "DEFENDANT" | "CASE";

/** Events that stop the clock of the rules that list them (backend `SuspensionKind`). */
export type SuspensionKind = "REBELLION" | "MEDIATION" | "FEDERAL_EXTRAORDINARY_APPEAL";

/** Backend `DeadlineRuleView`: a built-in rule with the firm's two settings. */
export interface DeadlineRule {
  code: string;
  name: string;
  /** Article and law, ready to show: "Art. 118 · CPP de Neuquén (Ley 2784)". */
  source: string;
  article: string | null;
  trigger: string;
  kind: RuleKind;
  computation: Computation;
  /** In the unit of the computation; null for a judicial deadline. */
  duration: number | null;
  scope: RuleScope;
  detainee: boolean;
  consequence: string;
  caseLaw: { status: string; url: string | null; reviewedOn: string | null } | null;
  extensions: { grantedBy: string; maxAmount: number }[];
  suspendedBy: SuspensionKind[];
  flags: ReviewFlag[];
  note: string | null;
  enabled: boolean;
  alertDaysBefore: number;
  defaultAlertDaysBefore: number;
  /** "Cálculo asistido: verificá con la norma." */
  disclaimer: string;
}

/** `PUT /api/v1/deadline-rules/{code}/settings`: the only two things a firm can change. */
export interface DeadlineRuleSetting {
  enabled: boolean;
  alertDaysBefore: number;
}
