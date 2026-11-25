package ar.gestorpenal.news;

/** The post's text is missing or too long (400). */
class InvalidPostException extends RuntimeException {

    InvalidPostException(String message) {
        super(message);
    }
}
