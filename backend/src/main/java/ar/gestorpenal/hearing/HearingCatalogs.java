package ar.gestorpenal.hearing;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.CatalogItem;
import ar.gestorpenal.jurisdiction.CatalogService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Checks catalog codes against the current firm's catalogs (ADR-0013). Hearings and measures store
 * codes as text: a new or changed value must be a visible item, an unchanged value is accepted even if
 * the firm hid it later.
 */
@Component
class HearingCatalogs {

    private final CatalogService catalogs;

    HearingCatalogs(CatalogService catalogs) {
        this.catalogs = catalogs;
    }

    /** {@code currentCode} is the value the record already has, or {@code null} for a new record. */
    void requireOffered(Catalog catalog, String code, String currentCode) {
        if (code.equals(currentCode)) {
            return;
        }
        CatalogItem item = items(catalog).get(code);
        if (item == null) {
            throw new InvalidHearingDataException("The catalog " + catalog.id() + " has no item '" + code + "'");
        }
        if (item.hidden()) {
            throw new InvalidHearingDataException(
                    "The item '" + code + "' of the catalog " + catalog.id() + " is hidden in this firm");
        }
    }

    /** Every item (hidden ones too, so old records keep a readable name) by code, in catalog order. */
    Map<String, CatalogItem> items(Catalog catalog) {
        Map<String, CatalogItem> items = new LinkedHashMap<>();
        catalogs.view(catalog, true).items().forEach(item -> items.put(item.code(), item));
        return items;
    }

    /** The name of every item by code. */
    Map<String, String> names(Catalog catalog) {
        Map<String, String> names = new LinkedHashMap<>();
        items(catalog).forEach((code, item) -> names.put(code, item.name()));
        return names;
    }
}
