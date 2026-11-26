package ar.gestorpenal.fee;

/** The firm already has an active JUS value from that day (409). */
class DuplicateJusValueException extends RuntimeException {

    DuplicateJusValueException(String message) {
        super(message);
    }
}
