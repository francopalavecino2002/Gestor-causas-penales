package ar.gestorpenal.user;

/** No user with that id in the current firm (another firm's id answers the same). */
class UserNotFoundException extends RuntimeException {

    UserNotFoundException() {
        super("There is no such user in this firm");
    }
}
