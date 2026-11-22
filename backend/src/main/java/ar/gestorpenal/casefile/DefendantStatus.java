package ar.gestorpenal.casefile;

/** Where a defendant stands inside their stage. A closed defendant is in the stage {@code cerrada}. */
enum DefendantStatus {
    ACTIVE,
    /** For instance a probation period (suspensión de juicio a prueba). */
    SUSPENDED,
    IN_MEDIATION,
    CLOSED
}
