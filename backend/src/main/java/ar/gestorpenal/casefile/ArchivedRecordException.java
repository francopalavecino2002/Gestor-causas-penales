package ar.gestorpenal.casefile;

/** The case or defendant is archived: restore it before changing it (answered as 409). */
class ArchivedRecordException extends RuntimeException {

    ArchivedRecordException(String message) {
        super(message);
    }
}
