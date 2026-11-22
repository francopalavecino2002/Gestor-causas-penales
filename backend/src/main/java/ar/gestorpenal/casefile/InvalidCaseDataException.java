package ar.gestorpenal.casefile;

/** The data is well formed but breaks a rule of cases, defendants, parties or teams (answered as 400). */
class InvalidCaseDataException extends RuntimeException {

    InvalidCaseDataException(String message) {
        super(message);
    }
}
