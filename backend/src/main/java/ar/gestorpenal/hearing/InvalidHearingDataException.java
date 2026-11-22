package ar.gestorpenal.hearing;

/** The request breaks a rule of hearings or coercive measures (answered as 400). */
class InvalidHearingDataException extends RuntimeException {

    InvalidHearingDataException(String message) {
        super(message);
    }
}
