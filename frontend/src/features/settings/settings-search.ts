import { ALL_CATALOG_IDS, type AnyCatalogId } from "@/features/catalogs/catalog-types";
import { parseAreaCode } from "@/features/cases/case-search";
import type { CustomFieldEntity } from "@/features/settings/settings-types";

/** The catalog shown first: the one a firm changes most. */
export const DEFAULT_CATALOG: AnyCatalogId = "hearing-types";

/**
 * `/ajustes/catalogos?catalogo=stages&fuero=civil`: the default catalog and the default area are
 * left out of the URL.
 */
export interface CatalogSearch {
  catalogo?: AnyCatalogId;
  /** The practice area whose catalogs are shown, when the firm works in more than one. */
  fuero?: string;
}

export function parseCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  const value = search.catalogo;
  const known = (ALL_CATALOG_IDS as readonly unknown[]).includes(value);
  return {
    catalogo: known && value !== DEFAULT_CATALOG ? (value as AnyCatalogId) : undefined,
    fuero: parseAreaCode(search.fuero),
  };
}

export function catalogOf(search: CatalogSearch): AnyCatalogId {
  return search.catalogo ?? DEFAULT_CATALOG;
}

/** `/ajustes/campos?para=imputados`: the cases' fields are the default and left out. */
export interface FieldSearch {
  para?: "imputados";
}

export function parseFieldSearch(search: Record<string, unknown>): FieldSearch {
  return { para: search.para === "imputados" ? "imputados" : undefined };
}

export function entityOf(search: FieldSearch): CustomFieldEntity {
  return search.para === "imputados" ? "DEFENDANT" : "CASE_FILE";
}
