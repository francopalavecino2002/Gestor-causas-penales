package ar.gestorpenal.security;

/** The recovery link is unknown, already used, replaced by a newer one, or expired. One answer for all. */
class InvalidResetTokenException extends RuntimeException {

    InvalidResetTokenException() {
        super("The password reset link is not valid or expired");
    }
}
