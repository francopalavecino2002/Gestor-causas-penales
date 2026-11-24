package ar.gestorpenal.aiassist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import ar.gestorpenal.aiassist.HearingNotificationReader.HearingTypeOption;
import ar.gestorpenal.aiassist.HearingNotificationReader.RawHearingDraft;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** The Gemini adapter against a fake server: request shape, key in a header, answer parsing, errors. */
class GeminiHearingNotificationReaderTests {

    private static final String NOTIFICATION =
            "Se fija audiencia de control de acusación para el 14/03/2035 a las 9:30 en Sala 3. Legajo ficticio.";
    private static final List<HearingTypeOption> TYPES =
            List.of(new HearingTypeOption("control-de-acusacion", "Control de la acusación"));

    private MockRestServiceServer server;
    private GeminiHearingNotificationReader reader;

    @BeforeEach
    void setUp() {
        AiAssistProperties properties = new AiAssistProperties(
                "clave-ficticia", "modelo-de-prueba", "https://gemini.example.test", Duration.ofSeconds(5));
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        reader = new GeminiHearingNotificationReader(properties, JsonMapper.builder().build(), builder);
    }

    @Test
    void shouldSendTheTextAndTheTypesWithTheKeyInAHeaderAndReadTheJsonAnswer() {
        server.expect(requestTo("https://gemini.example.test/v1beta/models/modelo-de-prueba:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "clave-ficticia"))
                .andExpect(content().string(containsString("control-de-acusacion: Control de la acusación")))
                .andExpect(content().string(containsString("Sala 3")))
                .andExpect(content().string(containsString("\"responseMimeType\":\"application/json\"")))
                .andRespond(withSuccess(answer("""
                        {\\"typeCode\\": \\"control-de-acusacion\\", \\"date\\": \\"2035-03-14\\", \\"time\\": \\"09:30\\", \\"durationMinutes\\": null, \\"room\\": \\"Sala 3\\", \\"judge\\": null, \\"ofijuReference\\": null, \\"extra\\": 1}"""),
                        MediaType.APPLICATION_JSON));

        RawHearingDraft draft = reader.read(NOTIFICATION, TYPES);

        assertThat(draft).isEqualTo(
                new RawHearingDraft("control-de-acusacion", "2035-03-14", "09:30", null, "Sala 3", null, null));
        server.verify();
    }

    @Test
    void shouldReportTheFreeTierLimitAsBusy() {
        server.expect(requestTo(startsWith("https://gemini.example.test/")))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertThatThrownBy(() -> reader.read(NOTIFICATION, TYPES))
                .isInstanceOfSatisfying(AiProviderException.class, exception -> assertThat(exception.busy()).isTrue());
    }

    @Test
    void shouldReportAServerErrorWithoutTheUsersText() {
        server.expect(requestTo(startsWith("https://gemini.example.test/")))
                .andRespond(withServerError());

        assertThatThrownBy(() -> reader.read(NOTIFICATION, TYPES))
                .isInstanceOfSatisfying(AiProviderException.class, exception -> {
                    assertThat(exception.busy()).isFalse();
                    assertThat(exception.getMessage()).doesNotContain("Sala 3");
                });
    }

    @Test
    void shouldRejectAnAnswerThatIsNotJson() {
        server.expect(requestTo(startsWith("https://gemini.example.test/")))
                .andRespond(withSuccess(answer("no es JSON"), MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> reader.read(NOTIFICATION, TYPES)).isInstanceOf(AiProviderException.class);
    }

    @Test
    void shouldRejectAnAnswerWithoutCandidates() {
        server.expect(requestTo(startsWith("https://gemini.example.test/")))
                .andRespond(withSuccess("{\"candidates\": []}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> reader.read(NOTIFICATION, TYPES)).isInstanceOf(AiProviderException.class);
    }

    /** A generateContent response whose only part carries {@code escapedText} (already JSON-escaped). */
    private static String answer(String escapedText) {
        return """
                {"candidates": [{"content": {"role": "model", "parts": [{"text": "%s"}]}, "finishReason": "STOP"}],
                 "usageMetadata": {"promptTokenCount": 120}}
                """.formatted(escapedText);
    }
}
