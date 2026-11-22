package ar.gestorpenal.deadline;

/** 409: the record, or the case or defendant it hangs from, is archived. */
class ArchivedDeadlineRecordException extends RuntimeException {

    ArchivedDeadlineRecordException(String message) {
        super(message);
    }
}
