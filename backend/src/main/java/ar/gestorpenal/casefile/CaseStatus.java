package ar.gestorpenal.casefile;

/**
 * Where a case stands inside its stage, for the areas whose cases carry their own course (the ones
 * without the {@code defendants} module). A closed case is in the stage {@code cerrada}.
 */
enum CaseStatus {
    ACTIVE,
    SUSPENDED,
    IN_MEDIATION,
    CLOSED
}
