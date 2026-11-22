package ar.gestorpenal.hearing;

/**
 * The record does not exist for the current user: it is missing, belongs to another firm, or hangs
 * from a reserved case the user cannot see. All of them look the same on purpose (answered as 404).
 */
class HearingNotFoundException extends RuntimeException {

    HearingNotFoundException(String message) {
        super(message);
    }
}
