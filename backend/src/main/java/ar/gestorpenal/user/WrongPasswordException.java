package ar.gestorpenal.user;

/** The current password given to confirm a change does not match. */
public class WrongPasswordException extends RuntimeException {

    public WrongPasswordException() {
        super("The password is not valid");
    }
}
