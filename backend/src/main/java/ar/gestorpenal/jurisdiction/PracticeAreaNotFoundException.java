package ar.gestorpenal.jurisdiction;

/** The jurisdiction of the current firm has no practice area with this code. */
public class PracticeAreaNotFoundException extends RuntimeException {

    PracticeAreaNotFoundException(String areaCode) {
        super("There is no practice area '" + areaCode + "' in this jurisdiction");
    }
}
