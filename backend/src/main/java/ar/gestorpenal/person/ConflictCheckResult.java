package ar.gestorpenal.person;

import java.util.List;

/** Result of the conflict check by document number, always with the disclaimer. */
record ConflictCheckResult(List<DocumentMatch> matches, String disclaimer) {

    static final String DISCLAIMER =
            "Alerta simple por número de documento: revisá las causas antes de aceptar el caso.";

    static ConflictCheckResult of(List<DocumentMatch> matches) {
        return new ConflictCheckResult(matches, DISCLAIMER);
    }
}
