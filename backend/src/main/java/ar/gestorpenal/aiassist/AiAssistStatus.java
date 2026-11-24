package ar.gestorpenal.aiassist;

/**
 * @param available this installation has an AI provider configured
 * @param enabled the firm's owner turned the assistance on; it only works when both are true
 * @param provider who processes the text, so the screen can say it plainly
 */
record AiAssistStatus(boolean available, boolean enabled, String provider) {}
