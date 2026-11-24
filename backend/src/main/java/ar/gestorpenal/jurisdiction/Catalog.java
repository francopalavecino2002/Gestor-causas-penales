package ar.gestorpenal.jurisdiction;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Optional;

/**
 * The catalogs a jurisdiction package can provide (ADR-0013, ADR-0032). The id is the file name in
 * the package and the path segment in the API.
 *
 * <p>A catalog is either shared by every practice area of the jurisdiction ({@link Scope#JURISDICTION},
 * its file sits next to {@code jurisdiction.yml}) or belongs to one practice area ({@link Scope#AREA},
 * its file sits in the area's folder). An area catalog may need a {@link PracticeModule}: only areas
 * that declare the module provide the catalog.
 *
 * <p>Firms can always rename an item. Hiding and adding depend on the catalog: catalogs whose codes
 * drive behavior (stages, hearing statuses, computed liberty situations) or that mirror a closed
 * legal list cannot grow, and the first ones cannot shrink either.
 */
public enum Catalog {
    STAGES("stages", Scope.AREA, null, false, false),
    CLOSING_OUTCOMES("closing-outcomes", Scope.AREA, null, true, true),
    HEARING_TYPES("hearing-types", Scope.AREA, null, true, true),
    HEARING_STATUSES("hearing-statuses", Scope.AREA, null, false, false),
    CANCELLATION_REASONS("cancellation-reasons", Scope.AREA, null, true, true),
    PARTY_ROLES("party-roles", Scope.AREA, null, false, false),
    ACTION_TYPES("action-types", Scope.AREA, null, false, false),
    REPRESENTED_SIDES("represented-sides", Scope.AREA, null, false, false),
    COERCIVE_MEASURES("coercive-measures", Scope.AREA, PracticeModule.COERCIVE_MEASURES, true, false),
    PROCEDURAL_RISKS("procedural-risks", Scope.AREA, PracticeModule.COERCIVE_MEASURES, true, false),
    LIBERTY_SITUATIONS("liberty-situations", Scope.AREA, PracticeModule.DETAINEE_ALERTS, false, false),
    ALTERNATIVE_OUTCOMES("alternative-outcomes", Scope.AREA, PracticeModule.ALTERNATIVE_OUTCOMES, true, false),
    CIRCUMSCRIPTIONS("circumscriptions", Scope.JURISDICTION, null, true, true);

    /** Where a catalog lives in the package. */
    public enum Scope {
        /** Shared by every practice area of the jurisdiction. */
        JURISDICTION,
        /** One per practice area. */
        AREA
    }

    private final String id;
    private final Scope scope;
    private final PracticeModule module;
    private final boolean hideable;
    private final boolean extensible;

    Catalog(String id, Scope scope, PracticeModule module, boolean hideable, boolean extensible) {
        this.id = id;
        this.scope = scope;
        this.module = module;
        this.hideable = hideable;
        this.extensible = extensible;
    }

    @JsonValue
    public String id() {
        return id;
    }

    public Scope scope() {
        return scope;
    }

    /** The module an area must declare to provide this catalog, or {@code null} when every area does. */
    public PracticeModule module() {
        return module;
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
