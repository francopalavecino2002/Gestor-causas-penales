package ar.gestorpenal.jurisdiction;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Optional;

/**
 * The catalogs every jurisdiction package must provide (ADR-0013). The id is the file name in the
 * package and the path segment in the API.
 *
 * <p>Firms can always rename an item. Hiding and adding depend on the catalog: catalogs whose codes
 * drive behavior (stages, hearing statuses, computed liberty situations) or that mirror a closed
 * legal list cannot grow, and the first ones cannot shrink either.
 */
public enum Catalog {
    STAGES("stages", false, false),
    CLOSING_OUTCOMES("closing-outcomes", true, true),
    HEARING_TYPES("hearing-types", true, true),
    HEARING_STATUSES("hearing-statuses", false, false),
    CANCELLATION_REASONS("cancellation-reasons", true, true),
    COERCIVE_MEASURES("coercive-measures", true, false),
    PROCEDURAL_RISKS("procedural-risks", true, false),
    LIBERTY_SITUATIONS("liberty-situations", false, false),
    ALTERNATIVE_OUTCOMES("alternative-outcomes", true, false),
    CIRCUMSCRIPTIONS("circumscriptions", true, true);

    private final String id;
    private final boolean hideable;
    private final boolean extensible;

    Catalog(String id, boolean hideable, boolean extensible) {
        this.id = id;
        this.hideable = hideable;
        this.extensible = extensible;
    }

    @JsonValue
    public String id() {
        return id;
    }

    /** Whether a firm may hide items so they are no longer offered for new records. */
    public boolean hideable() {
        return hideable;
    }

    /** Whether a firm may add its own items. An extensible catalog is always hideable. */
    public boolean extensible() {
        return extensible;
    }

    public static Optional<Catalog> fromId(String id) {
        return Arrays.stream(values()).filter(catalog -> catalog.id.equals(id)).findFirst();
    }
}
