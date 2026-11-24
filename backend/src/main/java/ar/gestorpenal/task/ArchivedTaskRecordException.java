package ar.gestorpenal.task;

/** 409: an archived record is read-only until it is restored. */
class ArchivedTaskRecordException extends RuntimeException {

    ArchivedTaskRecordException(String message) {
        super(message);
    }
}
