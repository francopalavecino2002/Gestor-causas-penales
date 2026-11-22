package ar.gestorpenal.dataimport;

import java.util.List;

/**
 * The file cannot be read as an import of this kind (answered as 400). {@code headers} names the
 * offending headers when the problem is in them, so the user can find the typo.
 */
class InvalidImportFileException extends RuntimeException {

    private final transient List<String> headers;

    InvalidImportFileException(String message) {
        this(message, List.of());
    }

    InvalidImportFileException(String message, List<String> headers) {
        super(message);
        this.headers = List.copyOf(headers);
    }

    List<String> headers() {
        return headers;
    }
}
