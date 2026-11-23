import { cppArticle } from "@/features/agenda/agenda-format";
import type { CatalogItem, ReviewFlag } from "@/features/catalogs/catalog-types";

const FLAG_TAGS: Record<ReviewFlag, string> = {
  validar: "[validar]",
  "no-verificado": "[no verificado]",
};

/** "[validar]", "[no verificado]": the review tags, kept visible next to the item (CLAUDE.md). */
export function reviewTags(flags: ReviewFlag[]): string {
  return flags.map((flag) => FLAG_TAGS[flag]).join(" ");
}

/**
 * What an `<option>` says for a catalog item: its name, the CPP article when it has one and
 * its review tags, e.g. "Control de acusación (CPP arts. 167 a 169)".
 */
export function catalogOptionLabel(item: CatalogItem, options: { article?: boolean } = {}): string {
  const article = options.article === false ? null : cppArticle(item.article);
  const tags = reviewTags(item.flags);
  return [item.name, article && `(${article})`, tags].filter(Boolean).join(" ");
}
