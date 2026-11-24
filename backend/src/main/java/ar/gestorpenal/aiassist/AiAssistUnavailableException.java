package ar.gestorpenal.aiassist;

/** This installation has no AI provider configured. */
class AiAssistUnavailableException extends RuntimeException {

    AiAssistUnavailableException() {
        super("No AI provider is configured in this installation");
    }
}
