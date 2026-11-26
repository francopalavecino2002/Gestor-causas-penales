package ar.gestorpenal.user;

/** A new password that the rules reject (length, bcrypt's byte limit, same as before). */
public class InvalidPasswordException extends RuntimeException {

    public InvalidPasswordException(String detail) {
        super(detail);
    }
}
