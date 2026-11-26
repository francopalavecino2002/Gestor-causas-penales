package ar.gestorpenal.fee;

/** A JUS value of the firm, or the fees scale of its jurisdiction, does not exist (404). */
class FeeNotFoundException extends RuntimeException {

    FeeNotFoundException(String message) {
        super(message);
    }
}
