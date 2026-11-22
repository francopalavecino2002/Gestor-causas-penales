/** Ids of the catalogs this frontend reads (backend `Catalog`). */
export type CatalogId = "stages" | "hearing-types" | "liberty-situations";

/** Review status kept visible next to an entry (backend `ReviewFlag`). */
export type ReviewFlag = "validar" | "no-verificado";

/** A catalog item as the firm sees it (backend `CatalogItem`). */
export interface CatalogItem {
  code: string;
  name: string;
  sourceName: string | null;
  article: string | null;
  flags: ReviewFlag[];
  note: string | null;
  hidden: boolean;
}

/** `GET /api/v1/catalogs/{id}` (backend `CatalogView`). */
export interface CatalogView {
  catalog: CatalogId;
  jurisdiction: string;
  packageVersion: number;
  source: string | null;
  flags: ReviewFlag[];
  note: string | null;
  items: CatalogItem[];
}
