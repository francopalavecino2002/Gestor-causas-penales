package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TotpTests {

    /** The SHA-1 seed of RFC 6238, appendix B. */
    private static final byte[] RFC_SECRET = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

    /** RFC 6238 publishes 8-digit codes; the 6-digit code is the same number modulo 10^6. */
    @ParameterizedTest
    @CsvSource({
        "59, 287082",
        "1111111109, 081804",
        "1111111111, 050471",
        "1234567890, 005924",
        "2000000000, 279037",
        "20000000000, 353130"
    })
    void shouldMatchTheRfc6238TestVectors(long epochSeconds, String expected) {
        long step = Totp.stepAt(Instant.ofEpochSecond(epochSeconds));

        assertThat(Totp.codeAt(RFC_SECRET, step)).isEqualTo(expected);
    }

    @Test
    void shouldAcceptOneStepOfDriftInEachDirection() {
        Instant now = Instant.ofEpochSecond(1_234_567_890);
        long current = Totp.stepAt(now);

        assertThat(Totp.matchingStep(RFC_SECRET, Totp.codeAt(RFC_SECRET, current - 1), now)).hasValue(current - 1);
        assertThat(Totp.matchingStep(RFC_SECRET, Totp.codeAt(RFC_SECRET, current), now)).hasValue(current);
        assertThat(Totp.matchingStep(RFC_SECRET, Totp.codeAt(RFC_SECRET, current + 1), now)).hasValue(current + 1);
    }

    @Test
    void shouldRejectCodesOutsideTheDriftWindow() {
        Instant now = Instant.ofEpochSecond(1_234_567_890);
        long current = Totp.stepAt(now);

        assertThat(Totp.matchingStep(RFC_SECRET, Totp.codeAt(RFC_SECRET, current - 2), now)).isEmpty();
        assertThat(Totp.matchingStep(RFC_SECRET, Totp.codeAt(RFC_SECRET, current + 2), now)).isEmpty();
    }

    @Test
    void shouldRejectMalformedCodes() {
        Instant now = Instant.ofEpochSecond(1_234_567_890);

        assertThat(Totp.matchingStep(RFC_SECRET, "", now)).isEmpty();
        assertThat(Totp.matchingStep(RFC_SECRET, "00592", now)).isEmpty();
        assertThat(Totp.matchingStep(RFC_SECRET, "0059244", now)).isEmpty();
        assertThat(Totp.matchingStep(RFC_SECRET, "00592a", now)).isEmpty();
    }
}
