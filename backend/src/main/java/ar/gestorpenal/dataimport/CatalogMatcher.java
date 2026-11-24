package ar.gestorpenal.dataimport;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.CatalogItem;
import ar.gestorpenal.jurisdiction.CatalogService;
import ar.gestorpenal.jurisdiction.PracticeAreaView;
import ar.gestorpenal.jurisdiction.PracticeAreas;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Reads a catalog cell: the item's code or its visible name, ignoring case and accents. Only items
 * the firm offers (not hidden) match, like on the regular endpoints (ADR-0013). The catalogs are those
 * of the practice area of the row's case (ADR-0032), which the caller resolves first: with
 * {@link #practiceArea} for a new case, from the stored case for a hearing.
 */
@Component
public class CatalogMatcher {

    private final CatalogService catalogs;
    private final PracticeAreas areas;

    CatalogMatcher(CatalogService catalogs, PracticeAreas areas) {
        this.catalogs = catalogs;
        this.areas = areas;
    }

    /**
     * The code of the practice area the cell names (its code or name), or {@code null} for a blank cell
     * or, with an error added to the row, an area that does not exist or that the firm has not enabled.
     */
    public String practiceArea(ImportRow row, String column, ImportContext context) {
        String value = row.text(column);
        if (value == null) {
            return null;
        }
        String wanted = ImportText.fold(value);
        List<PracticeAreaView> enabled = context.state(Cache.class, Cache::new).enabledAreas(areas);
        String code = enabled.stream()
                .filter(area -> ImportText.fold(area.code()).equals(wanted) || ImportText.fold(area.name()).equals(wanted))
                .map(PracticeAreaView::code)
                .findFirst()
                .orElse(null);
        if (code == null) {
            row.error(column, "El fuero no existe o no está habilitado en tu estudio. Fueros habilitados: "
                    + String.join(", ", enabled.stream().map(PracticeAreaView::code).toList()) + ".");
        }
        return code;
    }

    /**
     * The code of the item the cell names, or {@code null} for a blank cell or, with an error added to
     * the row, a value that is not in the area's catalog.
     */
    public String code(ImportRow row, String column, String area, Catalog catalog, ImportContext context) {
        return code(row, column, area, catalog, Map.of(), context);
    }

    /**
     * As {@link #code(ImportRow, String, String, Catalog, ImportContext)}, and a cell that is one of the
     * {@code aliases} (a folded word with underscores, like {@code instancia_privada}) names the aliased
     * code, if the area offers it: the words the templates always used.
     */
    public String code(
            ImportRow row, String column, String area, Catalog catalog, Map<String, String> aliases, ImportContext context) {
        String value = row.text(column);
        if (value == null) {
            return null;
        }
        String wanted = ImportText.fold(value);
        String aliased = aliases.get(ImportText.header(value));
        String code = context.state(Cache.class, Cache::new).offered(catalogs, area, catalog).stream()
                .filter(item -> ImportText.fold(item.code()).equals(wanted)
                        || ImportText.fold(item.name()).equals(wanted)
                        || item.code().equals(aliased))
                .map(CatalogItem::code)
                .findFirst()
                .orElse(null);
        if (code == null) {
            row.error(column, "El valor no figura en el catálogo de tu estudio para este fuero.");
        }
        return code;
    }

    private static final class Cache {
        private final Map<String, List<CatalogItem>> items = new HashMap<>();
        private List<PracticeAreaView> enabled;

        List<CatalogItem> offered(CatalogService catalogs, String area, Catalog catalog) {
            return items.computeIfAbsent(area + "/" + catalog.id(), key -> catalogs.view(area, catalog, false).items());
        }

        List<PracticeAreaView> enabledAreas(PracticeAreas areas) {
            if (enabled == null) {
                enabled = areas.enabled();
            }
            return enabled;
        }
    }
}
