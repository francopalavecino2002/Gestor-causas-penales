package ar.gestorpenal.casefile;

/** The defendant or party is already active in the case (answered as 409). */
class DuplicateRecordException extends RuntimeException {

    DuplicateRecordException(String message) {
        super(message);
    }
}
