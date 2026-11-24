package ar.gestorpenal.casefile;

/** Whom the firm represents in a case. */
enum Representation {
    /** The defence of the accused. */
    DEFENCE,
    /** The private prosecution (querella). */
    PRIVATE_PROSECUTION;

    /** The item of the penal {@code represented-sides} catalog that mirrors this value. */
    String catalogCode() {
        return CatalogCodes.of(this);
    }
}
