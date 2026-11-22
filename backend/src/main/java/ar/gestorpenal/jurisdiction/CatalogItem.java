package ar.gestorpenal.jurisdiction;

import java.util.List;
import java.util.Map;

/**
 * A catalog item as one firm sees it: the package definition with the firm's rename and hidden flag
 * applied, or an item the firm added.
 *
 * @param name the name to show: the firm's, or the package's when not renamed
 * @param sourceName the package's name, kept so a rename never hides the original; {@code null}
 *     for items added by the firm
 * @param article legal source; for built-in items always the package's
 * @param hidden hidden items are not offered for new records, but existing records keep them
 */
public record CatalogItem(
        String code,
        String name,
        String sourceName,
        String article,
        List<ReviewFlag> flags,
        String note,
        Map<String, String> attributes,
        Origin origin,
        boolean hidden) {

    public enum Origin {
        /** Comes from the jurisdiction package. */
        JURISDICTION,
        /** Added by the firm. */
        FIRM
    }

    static CatalogItem builtIn(CatalogItemDefinition definition, CatalogItemCustomization customization) {
        boolean renamed = customization != null && customization.getName() != null;
        return new CatalogItem(
                definition.code(),
                renamed ? customization.getName() : definition.name(),
                definition.name(),
                definition.article(),
                definition.flags(),
                definition.note(),
                definition.attributes(),
                Origin.JURISDICTION,
                customization != null && customization.isHidden());
    }

    static CatalogItem addedByFirm(CatalogItemCustomization item) {
        return new CatalogItem(item.getItemCode(), item.getName(), null, item.getArticle(), List.of(), null, Map.of(),
                Origin.FIRM, item.isHidden());
    }
}
