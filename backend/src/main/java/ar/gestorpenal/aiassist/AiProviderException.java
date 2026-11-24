package ar.gestorpenal.aiassist;

/** The AI provider failed or answered something unusable. The message never carries the user's text. */
class AiProviderException extends RuntimeException {

    private final boolean busy;

    AiProviderException(String message, boolean busy) {
        super(message);
        this.busy = busy;
    }

    AiProviderException(String message, Throwable cause) {
        super(message, cause);
        this.busy = false;
    }

    /** The provider asked to slow down (for example, the free tier's per-minute limit). */
    boolean busy() {
        return busy;
    }
}
