// Relative imports only: the e2e mock backend (tsconfig.node.json) uses these types and has no
// "@/" alias.
import type { ReviewFlag } from "../catalogs/catalog-types";

/** The minimum fee in JUS of one kind of matter (Ley 1594, art. 9). */
export interface FeeMinimum {
  code: string;
  name: string;
  jus: number;
  /** E.g. "art. 9, I, 16". */
  article: string;
  flags: ReviewFlag[];
  /** A caveat to show next to it; null when there is none. */
  note: string | null;
  /** Practice areas it applies to; empty means every area. */
  areas: string[];
}

export interface FeePercentages {
  article: string;
  minPercent: number;
  maxPercent: number;
  losingPartyFloorFactor: number;
  flags: ReviewFlag[];
}

export interface FeeFactor {
  article: string;
  /** A multiplier: 0.4 is 40%. */
  factor: number;
  flags: ReviewFlag[];
}

export interface FeeAppeal {
  article: string;
  minPercent: number;
  maxPercent: number;
  fullyRevokedPercent: number;
  flags: ReviewFlag[];
}

/** `GET /api/v1/fees/scale` (ADR-0040): the jurisdiction's rules, read-only for firms. */
export interface FeeScaleView {
  law: string;
  /** Where the text of the law can be read. */
  source: string;
  /** Where the Poder Judicial publishes the JUS value. */
  jusSource: string;
  disclaimer: string;
  scale: FeePercentages;
  procurador: FeeFactor;
  sponsorAndAttorney: FeeFactor;
  appeal: FeeAppeal;
  minimums: FeeMinimum[];
}

/** A JUS value the firm entered. Nothing is edited or deleted: a wrong one is archived. */
export interface JusValueView {
  id: string;
  /** Pesos. */
  value: number;
  /** ISO day it applies from. */
  validFrom: string;
  archived: boolean;
  createdAt: string;
}

/** `GET /api/v1/fees/jus-values`: newest first, and the one that applies today (or null). */
export interface JusValueHistory {
  current: JusValueView | null;
  values: JusValueView[];
}

export interface JusValueData {
  value: number;
  validFrom: string;
}

export type FeeRole = "SPONSOR" | "ATTORNEY" | "SPONSOR_AND_ATTORNEY";
export type FeeInstance = "FIRST" | "APPEAL" | "APPEAL_FULLY_REVOKED";

export interface CalculationRequest {
  /** Pesos; null for a matter that cannot be appraised in money. */
  amount: number | null;
  minimumCode: string;
  clientLostEntirely: boolean;
  role: FeeRole;
  instance: FeeInstance;
  /** ISO day whose JUS value applies. */
  date: string;
}

/** One step of a calculation, with the article that supports it. */
export interface FeeStep {
  description: string;
  article: string;
  /** Pesos after the step (the lower bound of a range); null when the step has no amount. */
  amount: number | null;
  /** The upper bound of a range; null for a single amount. */
  amountTo: number | null;
}

/** `POST /api/v1/fees/calculations`: nothing is stored. */
export interface FeeCalculation {
  minPesos: number;
  maxPesos: number;
  minJus: number;
  maxJus: number;
  jusValue: { value: number; validFrom: string };
  minimum: FeeMinimum;
  steps: FeeStep[];
  flags: ReviewFlag[];
  disclaimer: string;
  legalSource: string;
}
