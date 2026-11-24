package ar.gestorpenal.dataimport;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.CatalogItem;
import ar.gestorpenal.jurisdiction.CatalogService;
import ar.gestorpenal.tenancy.Tenant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Reads a catalog cell: the item's code or its visible name, ignoring case and accents. Only items
 * the firm offers (not hidden) match, like on the regular endpoints (ADR-0013). Imports create penal
 * cases for now (the area column of the files comes with the non-criminal areas, ADR-0032), so the
 * catalogs are those of the penal area.
 */
@Component
public class CatalogMatcher {

    private final CatalogService catalogs;

    CatalogMatcher(CatalogService catalogs) {
        this.catalogs = catalogs;
    }

    /**
     * The code of the item the cell names, or {@code null} for a blank cell or, with an error added to
     * the row, a value that is not in the catalog.
     */
    public String code(ImportRow row, String column, Catalog catalog, ImportContext context) {
        String value = row.text(column);
        if (value == null) {
            return null;
        }
        String wanted = ImportText.fold(value);
        String code = offered(catalog, context).stream()
                .filter(item -> ImportText.fold(item.code()).equals(wanted) || ImportText.fold(item.name()).equals(wanted))
                .map(CatalogItem::code)
                .findFirst()
                .orElse(null);
        if (code == null) {
            row.error(column, "El valor no figura en el catálogo de tu estudio.");
        }
        return code;
    }

    private List<CatalogItem> offered(Catalog catalog, ImportContext context) {
        return context.state(Cache.class, Cache::new)
                .items
                .computeIfAbsent(catalog, key -> catalogs.view(Tenant.DEFAULT_PRACTICE_AREA, key, false).items());
    }

    private static final class Cache {
        private final Map<Catalog, List<CatalogItem>> items = new EnumMap<>(Catalog.class);
    }
}
