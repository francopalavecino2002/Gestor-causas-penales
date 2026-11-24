package ar.gestorpenal.aiassist;

/** The firm has not turned the AI assistance on. */
class AiAssistDisabledException extends RuntimeException {

    AiAssistDisabledException() {
        super("The AI assistance is turned off in this firm");
    }
}
