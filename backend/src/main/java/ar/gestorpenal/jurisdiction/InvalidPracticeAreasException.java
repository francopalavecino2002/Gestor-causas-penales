package ar.gestorpenal.jurisdiction;

/** The practice areas a firm asked to work in are not a valid choice (none, or one the package lacks). */
public class InvalidPracticeAreasException extends RuntimeException {

    InvalidPracticeAreasException(String message) {
        super(message);
    }
}
