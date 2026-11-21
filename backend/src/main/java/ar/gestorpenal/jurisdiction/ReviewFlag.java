package ar.gestorpenal.jurisdiction;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Review status of a catalog entry, kept visible next to it (CLAUDE.md): the domain docs tag
 * assumptions with {@code [validar]} and secondary-source data with {@code [no verificado]}.
 */
public enum ReviewFlag {
    /** An assumption to confirm with a lawyer. */
    VALIDAR("validar"),
    /** Not read in the text of the code; it comes from secondary sources. */
    NO_VERIFICADO("no-verificado");

    private final String id;

    ReviewFlag(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
