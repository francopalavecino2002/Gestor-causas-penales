package ar.gestorpenal.user;

/** The firm already has a user, active or archived, with that email. */
class DuplicateEmailException extends RuntimeException {

    DuplicateEmailException() {
        super("The firm already has a user with that email");
    }
}
