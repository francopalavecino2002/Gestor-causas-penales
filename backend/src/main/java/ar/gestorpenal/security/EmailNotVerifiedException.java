package ar.gestorpenal.security;

/**
 * The firm, email and password are right, but the owner has not opened the verification link yet
 * (ADR-0050). Only thrown after the password matched, so it tells nothing to someone who does not know
 * it; a new link is on its way.
 */
class EmailNotVerifiedException extends RuntimeException {

    EmailNotVerifiedException() {
        super("The email address is not verified yet");
    }
}
