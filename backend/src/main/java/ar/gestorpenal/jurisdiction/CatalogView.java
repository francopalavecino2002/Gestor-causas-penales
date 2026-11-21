package ar.gestorpenal.jurisdiction;

import java.util.List;

/**
 * One catalog of the firm's jurisdiction, with the firm's changes applied.
 *
 * @param jurisdiction code of the jurisdiction package
 * @param packageVersion version of that package, to tell which revision of the data is shown
 * @param hideable whether the firm may hide items of this catalog
 * @param extensible whether the firm may add items to this catalog
 */
public record CatalogView(
        Catalog catalog,
        String jurisdiction,
        int packageVersion,
        String source,
        List<ReviewFlag> flags,
        String note,
        boolean hideable,
        boolean extensible,
        List<CatalogItem> items) {}
