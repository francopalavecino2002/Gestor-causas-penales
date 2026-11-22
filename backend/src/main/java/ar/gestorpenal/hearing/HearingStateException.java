package ar.gestorpenal.hearing;

/** The hearing's current status does not allow the operation, e.g. rescheduling a cancelled one (answered as 409). */
class HearingStateException extends RuntimeException {

    HearingStateException(String message) {
        super(message);
    }
}
