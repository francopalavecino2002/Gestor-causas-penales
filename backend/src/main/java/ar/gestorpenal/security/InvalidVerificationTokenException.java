package ar.gestorpenal.security;

/** The verification link is unknown, already used, replaced by a newer one, or expired. One answer for all. */
class InvalidVerificationTokenException extends RuntimeException {

    InvalidVerificationTokenException() {
        super("The email verification link is not valid or expired");
    }
}
