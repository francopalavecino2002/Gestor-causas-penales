package ar.gestorpenal.signup;

/** A value of the sign-up form is missing or not valid; nothing was created. */
class InvalidSignupException extends RuntimeException {

    InvalidSignupException(String message) {
        super(message);
    }
}
