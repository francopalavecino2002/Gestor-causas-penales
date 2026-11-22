package ar.gestorpenal.casefile;

/**
 * The record does not exist for the current user: it is missing, belongs to another firm or case, or
 * is a reserved case the user cannot see. All of them look the same on purpose (answered as 404).
 */
class CaseRecordNotFoundException extends RuntimeException {

    CaseRecordNotFoundException(String message) {
        super(message);
    }
}
