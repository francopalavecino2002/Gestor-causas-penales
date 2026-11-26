package ar.gestorpenal.fee;

/** The instance the fee is for (arts. 7 and 15 of the Ley 1594). */
enum FeeInstance {
    FIRST,
    /** Appeal: a share of the first instance fee. */
    APPEAL,
    /** Appeal where everything was revoked in favor of the appellant. */
    APPEAL_FULLY_REVOKED
}
