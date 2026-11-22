package ar.gestorpenal.person;

/**
 * The data is well formed but breaks a rule of persons, clients or contacts (answered as 400).
 * Public so that features that register people through {@link Persons} (the case import) can tell
 * the user which row was wrong.
 */
public class InvalidPersonDataException extends RuntimeException {

    InvalidPersonDataException(String message) {
        super(message);
    }
}
