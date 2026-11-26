package ar.gestorpenal.fee;

/** Who collects the fee (art. 10 of the Ley 1594). */
enum FeeRole {
    /** Abogado patrocinante: the base fee. */
    SPONSOR,
    /** Apoderado (procurador): a share of the sponsor's fee. */
    ATTORNEY,
    /** Apoderado and patrocinante at once: both fees. */
    SPONSOR_AND_ATTORNEY
}
