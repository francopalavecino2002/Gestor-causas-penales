package ar.gestorpenal.hearing;

/** The case, defendant or hearing is archived: restore it before changing it (answered as 409). */
class ArchivedHearingRecordException extends RuntimeException {

    ArchivedHearingRecordException(String message) {
        super(message);
    }
}
