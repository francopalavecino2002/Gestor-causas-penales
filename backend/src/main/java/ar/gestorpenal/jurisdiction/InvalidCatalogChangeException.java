package ar.gestorpenal.jurisdiction;

/** The requested change is malformed, for example a firm item without a name. */
public class InvalidCatalogChangeException extends RuntimeException {

    InvalidCatalogChangeException(String message) {
        super(message);
    }
}
