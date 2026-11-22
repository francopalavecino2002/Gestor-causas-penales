package ar.gestorpenal.jurisdiction;

/** The catalog does not allow the change, for example hiding a stage (see {@link Catalog}). */
public class CatalogChangeNotAllowedException extends RuntimeException {

    CatalogChangeNotAllowedException(String message) {
        super(message);
    }
}
