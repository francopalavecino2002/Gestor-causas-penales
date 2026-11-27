package ar.gestorpenal.bootstrap;

/** The database already has a firm: the first-firm bootstrap only runs on an empty one. */
public class FirmAlreadyExistsException extends IllegalStateException {

    FirmAlreadyExistsException() {
        super("A firm already exists: the first-firm bootstrap only runs on an empty database."
                + " Create more users from Ajustes > Usuarios.");
    }
}
