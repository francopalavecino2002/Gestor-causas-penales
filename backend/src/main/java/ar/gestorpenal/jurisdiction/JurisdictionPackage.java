package ar.gestorpenal.jurisdiction;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.Map;

/**
 * A jurisdiction as configuration (ADR-0013): its metadata and one definition per {@link Catalog}.
 * Loaded once from {@code resources/jurisdictions/<code>/} and shared, read-only, by every firm of
 * that jurisdiction.
 */
public record JurisdictionPackage(
        String code,
        String name,
        int version,
        String law,
        LocalDate reviewedOn,
        String source,
        Map<Catalog, CatalogDefinition> catalogs) {

    public JurisdictionPackage {
        catalogs = Map.copyOf(new EnumMap<>(catalogs));
    }

    public CatalogDefinition catalog(Catalog catalog) {
        return catalogs.get(catalog);
    }

    /** The {@code jurisdiction.yml} manifest, before its catalogs are read. */
    record Manifest(String code, String name, int version, String law, LocalDate reviewedOn, String source) {}
}
