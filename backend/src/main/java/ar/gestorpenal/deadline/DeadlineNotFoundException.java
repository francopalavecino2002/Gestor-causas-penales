package ar.gestorpenal.deadline;

/** 404: the record does not exist in the firm, or belongs to a reserved case the user cannot see. */
class DeadlineNotFoundException extends RuntimeException {

    DeadlineNotFoundException(String message) {
        super(message);
    }
}
