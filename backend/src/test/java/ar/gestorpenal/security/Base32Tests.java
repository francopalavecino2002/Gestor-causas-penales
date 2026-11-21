package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class Base32Tests {

    /** RFC 4648, section 10, without the padding. */
    @ParameterizedTest
    @CsvSource({"f, MY", "fo, MZXQ", "foo, MZXW6", "foob, MZXW6YQ", "fooba, MZXW6YTB", "foobar, MZXW6YTBOI"})
    void shouldMatchTheRfc4648TestVectors(String text, String encoded) {
        byte[] data = text.getBytes(StandardCharsets.US_ASCII);

        assertThat(Base32.encode(data)).isEqualTo(encoded);
        assertThat(Base32.decode(encoded)).isEqualTo(data);
    }

    @Test
    void shouldRoundTripATotpSecret() {
        byte[] secret = new byte[Totp.SECRET_BYTES];
        new SecureRandom().nextBytes(secret);

        String encoded = Base32.encode(secret);

        assertThat(encoded).hasSize(32).matches("[A-Z2-7]+");
        assertThat(Base32.decode(encoded)).isEqualTo(secret);
    }

    @Test
    void shouldDecodeTheWayUsersTypeIt() {
        assertThat(Base32.decode("mzxw 6ytb oi==")).isEqualTo("foobar".getBytes(StandardCharsets.US_ASCII));
    }

    @Test
    void shouldRejectCharactersOutsideTheAlphabet() {
        assertThatIllegalArgumentException().isThrownBy(() -> Base32.decode("MZXW1"));
    }
}
