package ar.gestorpenal.fee;

/** A request field the fees feature cannot accept; {@code field} names it for the client. */
class InvalidFeeDataException extends RuntimeException {

    private final String field;

    InvalidFeeDataException(String field, String message) {
        super(message);
        this.field = field;
    }

    String field() {
        return field;
    }
}
