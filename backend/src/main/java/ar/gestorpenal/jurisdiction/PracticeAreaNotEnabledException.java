package ar.gestorpenal.jurisdiction;

/** The practice area exists, but the current firm has not enabled it. */
public class PracticeAreaNotEnabledException extends RuntimeException {

    PracticeAreaNotEnabledException(String areaCode) {
        super("The practice area '" + areaCode + "' is not enabled for this firm");
    }
}
