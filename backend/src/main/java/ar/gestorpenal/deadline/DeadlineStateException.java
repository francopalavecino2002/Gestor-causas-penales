package ar.gestorpenal.deadline;

/** 409: the change is not allowed in the current state (a disabled rule, no extension left). */
class DeadlineStateException extends RuntimeException {

    DeadlineStateException(String message) {
        super(message);
    }
}
