// Relative imports only: the e2e mock backend (tsconfig.node.json) uses these types and has no
// "@/" alias.
import type { ReviewFlag } from "../catalogs/catalog-types";

/** An optional feature a practice area turns on (backend `PracticeModule`, ADR-0032). */
export type PracticeModule =
  "defendants" | "coercive-measures" | "detainee-alerts" | "alternative-outcomes" | "mpf-legajo";

/** A practice area (fuero) the firm works in (backend `PracticeAreaView`). */
export interface PracticeArea {
  /** "penal", "civil", "laboral", "familia". */
  code: string;
  name: string;
  /** The procedural law, e.g. "CPP de Neuquén (Ley 2784)". */
  law: string;
  /** ISO day of the last review of the package. */
  reviewedOn: string | null;
  source: string | null;
  /** Review flags of the area as a whole: a draft area ships flagged. */
  flags: ReviewFlag[];
  /** The caveat shown with a draft area, or null. */
  note: string | null;
  modules: PracticeModule[];
}

/** An area of the jurisdiction package, on or off for the firm (backend `PracticeAreaOption`). */
export interface PracticeAreaOption extends PracticeArea {
  enabled: boolean;
}
