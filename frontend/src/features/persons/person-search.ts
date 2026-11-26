import { isCaseId, parseCaseListSearch } from "@/features/cases/case-search";

/**
 * The person list's state in the URL: `?q=`, `?pagina=` (from 1) and `?archivadas=si`. Same rules
 * as the case list, except that a document number never goes in the URL (nor in the history or a
 * shared link): the screen keeps such a search in memory only.
 */
export interface PersonListSearch {
  q?: string;
  pagina?: number;
  archivadas?: "si";
}

/**
 * Search text that is a document number: at least 6 digits, with optional dots, dashes or spaces,
 * and at most a few letters (a passport). Names never match.
 */
export function looksLikeDocument(text: string): boolean {
  return /^[A-Z]{0,3}\d{6,}[A-Z]?$/i.test(text.replace(/[\s.-]/g, ""));
}

/** Keeps only valid values; a document number that arrived in a link is dropped. */
export function parsePersonListSearch(search: Record<string, unknown>): PersonListSearch {
  const { q, pagina, archivadas } = parseCaseListSearch(search);
  return { q: q && !looksLikeDocument(q) ? q : undefined, pagina, archivadas };
}

/** A person id as the backend writes it (a UUID, like a case id). */
export const isPersonId = isCaseId;
