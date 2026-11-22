package ar.gestorpenal.person;

/** The data is well formed but breaks a rule of persons, clients or contacts (answered as 400). */
class InvalidPersonDataException extends RuntimeException {

    InvalidPersonDataException(String message) {
        super(message);
    }
}
