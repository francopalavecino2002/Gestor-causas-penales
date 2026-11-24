package ar.gestorpenal.jurisdiction;

import java.time.LocalDate;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * A jurisdiction as configuration (ADR-0013, ADR-0032): its metadata, the catalogs shared by every
 * practice area, and one {@link PracticeArea} per area folder. Loaded once from
 * {@code resources/jurisdictions/<code>/} and shared, read-only, by every firm of that jurisdiction.
 *
 * @param catalogs the catalogs of {@link Catalog.Scope#JURISDICTION} scope
 * @param areas the practice areas by code, in folder order
 */
public record JurisdictionPackage(
        String code,
        String name,
        int version,
        String law,
        LocalDate reviewedOn,
        String source,
        Map<Catalog, CatalogDefinition> catalogs,
        Map<String, PracticeArea> areas) {

    public JurisdictionPackage {
        catalogs = Collections.unmodifiableMap(new EnumMap<>(catalogs));
        areas = Collections.unmodifiableMap(new LinkedHashMap<>(areas));
    }

    /** A catalog shared by every practice area of the jurisdiction. */
    public CatalogDefinition sharedCatalog(Catalog catalog) {
        return catalogs.get(catalog);
    }

    public Optional<PracticeArea> area(String areaCode) {
        return Optional.ofNullable(areas.get(areaCode));
    }

    /** The {@code jurisdiction.yml} manifest, before its catalogs and areas are read. */
    record Manifest(String code, String name, int version, String law, LocalDate reviewedOn, String source) {}
}
