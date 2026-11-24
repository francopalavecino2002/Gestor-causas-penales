/** Ids of the catalogs the case screens read (backend `Catalog`). */
export type CatalogId = "stages" | "hearing-types" | "liberty-situations";

/** Every catalog a jurisdiction package provides (backend `Catalog`), in the backend's order. */
export const ALL_CATALOG_IDS = [
  "stages",
  "closing-outcomes",
  "hearing-types",
  "hearing-statuses",
  "cancellation-reasons",
  "coercive-measures",
  "procedural-risks",
  "liberty-situations",
  "alternative-outcomes",
  "circumscriptions",
  "party-roles",
  "action-types",
  "represented-sides",
] as const;

export type AnyCatalogId = (typeof ALL_CATALOG_IDS)[number];

/** Review status kept visible next to an entry (backend `ReviewFlag`). */
export type ReviewFlag = "validar" | "no-verificado";

/** A catalog item as the firm sees it (backend `CatalogItem`). */
export interface CatalogItem {
  code: string;
  /** The firm's name, or the package's when not renamed. */
  name: string;
  /** The package's name, kept so a rename never hides it; null for items the firm added. */
  sourceName: string | null;
  article: string | null;
  flags: ReviewFlag[];
  note: string | null;
  /** From the jurisdiction package, or added by the firm. */
  origin: "JURISDICTION" | "FIRM";
  hidden: boolean;
}

/** `GET /api/v1/catalogs/{id}` (backend `CatalogView`). */
export interface CatalogView {
  catalog: AnyCatalogId;
  jurisdiction: string;
  packageVersion: number;
  source: string | null;
  flags: ReviewFlag[];
  note: string | null;
  /** Whether the firm may hide items (they stay on the records that use them). */
  hideable: boolean;
  /** Whether the firm may add its own items. */
  extensible: boolean;
  items: CatalogItem[];
}
