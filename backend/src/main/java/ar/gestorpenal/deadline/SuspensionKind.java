package ar.gestorpenal.deadline;

/** Events that stop the clock of the rules that list them. */
enum SuspensionKind {
    /** Rebeldía (art. 52): taken from the defendant's own dates, only for that defendant. */
    REBELLION,
    /** Mediación penal (Ley 2996 [validar]): loaded on the case. */
    MEDIATION,
    /** Recurso extraordinario federal: does not count for the duration of the process (art. 87). */
    FEDERAL_EXTRAORDINARY_APPEAL;

    /** Rebellion is read from the defendant; the other kinds are loaded as suspensions. */
    boolean loadedByHand() {
        return this != REBELLION;
    }
}
