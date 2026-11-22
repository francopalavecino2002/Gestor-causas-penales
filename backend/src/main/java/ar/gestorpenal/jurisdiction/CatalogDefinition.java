package ar.gestorpenal.jurisdiction;

import java.util.List;
import java.util.Optional;

/**
 * One catalog of a jurisdiction package, with its items in display order.
 *
 * @param source where the items come from (a law, a court report)
 * @param flags review flags that apply to the catalog as a whole
 * @param note caveat shown with the catalog, or {@code null}
 */
public record CatalogDefinition(
        Catalog catalog, String source, List<ReviewFlag> flags, String note, List<CatalogItemDefinition> items) {

    public CatalogDefinition {
        flags = flags == null ? List.of() : List.copyOf(flags);
        items = items == null ? List.of() : List.copyOf(items);
    }

    public Optional<CatalogItemDefinition> item(String code) {
        return items.stream().filter(item -> item.code().equals(code)).findFirst();
    }
}
