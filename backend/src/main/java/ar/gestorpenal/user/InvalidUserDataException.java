package ar.gestorpenal.user;

/** A new user's email or name that the rules reject. */
class InvalidUserDataException extends RuntimeException {

    InvalidUserDataException(String detail) {
        super(detail);
    }
}
