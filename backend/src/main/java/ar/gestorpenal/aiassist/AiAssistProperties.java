package ar.gestorpenal.aiassist;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * The AI provider of this installation (ADR-0033). Without an API key the assistance is unavailable
 * for every firm, whatever their setting says.
 *
 * @param geminiApiKey Google AI Studio key; blank means "no provider configured"
 * @param geminiModel the model id, e.g. {@code gemini-3.1-flash-lite}
 * @param timeout how long to wait for the provider before giving up
 */
@ConfigurationProperties("app.ai")
record AiAssistProperties(
        @DefaultValue("") String geminiApiKey,
        @DefaultValue("gemini-3.1-flash-lite") String geminiModel,
        @DefaultValue("https://generativelanguage.googleapis.com") String geminiBaseUrl,
        @DefaultValue("20s") Duration timeout) {

    boolean configured() {
        return geminiApiKey != null && !geminiApiKey.isBlank();
    }
}
