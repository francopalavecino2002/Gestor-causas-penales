package ar.gestorpenal.aiassist;

/** The firm asked for too many drafts in the last minute. */
class AiAssistRateLimitedException extends RuntimeException {

    AiAssistRateLimitedException() {
        super("Too many AI requests from this firm in the last minute");
    }
}
