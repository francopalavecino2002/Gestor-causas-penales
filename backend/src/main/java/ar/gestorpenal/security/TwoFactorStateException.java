package ar.gestorpenal.security;

/** The request does not fit the user's two-factor state, e.g. enrolling twice. Answered with 409. */
class TwoFactorStateException extends RuntimeException {

    TwoFactorStateException(String detail) {
        super(detail);
    }
}
