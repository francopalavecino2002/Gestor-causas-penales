package ar.gestorpenal.jurisdiction;

import java.time.LocalDate;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * One practice area (fuero) of a jurisdiction package (ADR-0032): its metadata, the modules it turns
 * on and its own catalogs. Loaded from {@code resources/jurisdictions/<jurisdiction>/<area>/}.
 *
 * @param flags review flags of the area as a whole (non-criminal areas ship flagged until reviewed)
 * @param note caveat shown with the area, or {@code null}
 * @param modules the optional features of the area, in the order of the manifest
 */
public record PracticeArea(
        String code,
        String name,
        String law,
        LocalDate reviewedOn,
        String source,
        List<ReviewFlag> flags,
        String note,
        List<PracticeModule> modules,
        Map<Catalog, CatalogDefinition> catalogs) {

    public PracticeArea {
        flags = flags == null ? List.of() : List.copyOf(flags);
        modules = List.copyOf(modules);
        catalogs = Collections.unmodifiableMap(new EnumMap<>(catalogs));
    }

    public boolean hasModule(PracticeModule module) {
        return modules.contains(module);
    }

    /** The area's catalog, or {@code null} when the area does not provide it (its module is off). */
    public CatalogDefinition catalog(Catalog catalog) {
        return catalogs.get(catalog);
    }

    /** The {@code area.yml} manifest, before its catalogs are read. */
    record Manifest(
            String code,
            String name,
            String law,
            LocalDate reviewedOn,
            String source,
            List<ReviewFlag> flags,
            String note,
            List<String> modules) {}
}
