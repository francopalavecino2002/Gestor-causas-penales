package ar.gestorpenal.news;

/** The firm has no such post (404). */
class PostNotFoundException extends RuntimeException {

    PostNotFoundException(String message) {
        super(message);
    }
}
