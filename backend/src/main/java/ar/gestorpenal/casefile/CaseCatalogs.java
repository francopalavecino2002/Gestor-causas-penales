package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.CatalogItem;
import ar.gestorpenal.jurisdiction.CatalogService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Checks catalog codes against the current firm's catalogs (ADR-0013). Cases store codes as text: a
 * new or changed value must be a visible item, an unchanged value is accepted even if the firm hid
 * it later.
 */
@Component
class CaseCatalogs {

    private final CatalogService catalogs;

    CaseCatalogs(CatalogService catalogs) {
        this.catalogs = catalogs;
    }

    /** {@code currentCode} is the value the record already has, or {@code null} for a new record. */
    void requireOffered(Catalog catalog, String code, String currentCode) {
        if (code.equals(currentCode)) {
            return;
        }
        CatalogItem item = catalogs.view(catalog, true).items().stream()
                .filter(candidate -> candidate.code().equals(code))
                .findFirst()
                .orElseThrow(() -> new InvalidCaseDataException(
                        "The catalog " + catalog.id() + " has no item '" + code + "'"));
        if (item.hidden()) {
            throw new InvalidCaseDataException(
                    "The item '" + code + "' of the catalog " + catalog.id() + " is hidden in this firm");
        }
    }

    /** Name of every item (hidden ones too, so old records keep a readable name) by code, in catalog order. */
    Map<String, String> names(Catalog catalog) {
        Map<String, String> names = new LinkedHashMap<>();
        catalogs.view(catalog, true).items().forEach(item -> names.put(item.code(), item.name()));
        return names;
    }

    /** The codes of the stages catalog in procedural order. */
    List<String> stageOrder() {
        return List.copyOf(names(Catalog.STAGES).keySet());
    }
}
