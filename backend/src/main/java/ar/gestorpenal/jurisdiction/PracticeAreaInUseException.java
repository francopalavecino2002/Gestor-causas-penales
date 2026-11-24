package ar.gestorpenal.jurisdiction;

/** A practice area cannot be turned off while the firm has active (not archived) cases in it. */
public class PracticeAreaInUseException extends RuntimeException {

    PracticeAreaInUseException(String areaCode) {
        super("The practice area '" + areaCode + "' has active cases: archive them before turning it off");
    }
}
