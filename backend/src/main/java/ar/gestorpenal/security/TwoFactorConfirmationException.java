package ar.gestorpenal.security;

/**
 * A logged-in user's two-factor change was not confirmed: wrong code or password. Answered with 422,
 * not 401, because the session itself is still valid.
 */
class TwoFactorConfirmationException extends RuntimeException {

    TwoFactorConfirmationException() {
        super("The code or password is not valid");
    }
}
