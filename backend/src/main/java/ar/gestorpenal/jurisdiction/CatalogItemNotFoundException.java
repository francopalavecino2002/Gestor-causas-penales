package ar.gestorpenal.jurisdiction;

/** The catalog, or the item inside it, does not exist for the current firm. */
public class CatalogItemNotFoundException extends RuntimeException {

    CatalogItemNotFoundException(String message) {
        super(message);
    }
}
