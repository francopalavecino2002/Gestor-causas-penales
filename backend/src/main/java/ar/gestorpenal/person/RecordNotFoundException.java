package ar.gestorpenal.person;

/** The person, client or contact does not exist in the current firm (answered as 404). */
class RecordNotFoundException extends RuntimeException {

    RecordNotFoundException(String message) {
        super(message);
    }
}
