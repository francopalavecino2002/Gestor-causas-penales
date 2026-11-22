package ar.gestorpenal.jurisdiction;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A built-in catalog item as the jurisdiction package defines it. Firms never change it: their
 * renames and hidden flags are stored apart, so the original name and legal source stay available.
 *
 * @param code stable identifier that records reference; never renamed or removed
 * @param article legal source: CPP articles unless another law is named (for example "Ley 2879"),
 *     or {@code null} when the item has none
 * @param attributes catalog-specific data in file order, such as a hearing type's group
 */
public record CatalogItemDefinition(
        String code,
        String name,
        String article,
        List<ReviewFlag> flags,
        String note,
        Map<String, String> attributes) {

    public CatalogItemDefinition {
        flags = flags == null ? List.of() : List.copyOf(flags);
        attributes = attributes == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(attributes));
    }
}
