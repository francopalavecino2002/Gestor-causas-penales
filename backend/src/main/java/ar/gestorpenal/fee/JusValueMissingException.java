package ar.gestorpenal.fee;

/** The firm has no active JUS value on or before the chosen day (409). */
class JusValueMissingException extends RuntimeException {

    static final String MESSAGE = "Cargá el valor del JUS";

    JusValueMissingException() {
        super(MESSAGE);
    }
}
