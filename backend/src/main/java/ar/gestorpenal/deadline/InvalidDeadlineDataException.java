package ar.gestorpenal.deadline;

/** 400: the data breaks a rule of the deadline or of its rule. */
class InvalidDeadlineDataException extends RuntimeException {

    InvalidDeadlineDataException(String message) {
        super(message);
    }
}
