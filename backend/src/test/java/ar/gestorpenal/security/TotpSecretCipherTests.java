package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TotpSecretCipherTests {

    private static final String KEY =
            Base64.getEncoder().encodeToString("unit-test-only-key-of-32-bytes!!".getBytes(StandardCharsets.US_ASCII));
    private static final byte[] SECRET = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

    private final TotpSecretCipher cipher = new TotpSecretCipher(KEY);

    @Test
    void shouldDecryptWhatItEncrypted() {
        UUID userId = UUID.randomUUID();

        String stored = cipher.encrypt(SECRET, userId);

        assertThat(stored).startsWith("v1:");
        assertThat(cipher.decrypt(stored, userId)).isEqualTo(SECRET);
    }

    @Test
    void shouldUseAFreshNonceEveryTime() {
        UUID userId = UUID.randomUUID();

        assertThat(cipher.encrypt(SECRET, userId)).isNotEqualTo(cipher.encrypt(SECRET, userId));
    }

    @Test
    void shouldNotDecryptASecretCopiedToAnotherUser() {
        String stored = cipher.encrypt(SECRET, UUID.randomUUID());

        assertThatIllegalStateException().isThrownBy(() -> cipher.decrypt(stored, UUID.randomUUID()));
    }

    @Test
    void shouldNotDecryptWithAnotherKey() {
        UUID userId = UUID.randomUUID();
        String stored = cipher.encrypt(SECRET, userId);
        String otherKey =
                Base64.getEncoder().encodeToString("another-unit-test-key-32-bytes!!".getBytes(StandardCharsets.US_ASCII));

        assertThatIllegalStateException().isThrownBy(() -> new TotpSecretCipher(otherKey).decrypt(stored, userId));
    }

    @Test
    void shouldReportACorruptStoredValueAsIllegalState() {
        UUID userId = UUID.randomUUID();
        String stored = cipher.encrypt(SECRET, userId);

        assertThatIllegalStateException().isThrownBy(() -> cipher.decrypt(stored.substring(0, 10), userId));
        assertThatIllegalStateException().isThrownBy(() -> cipher.decrypt("v1:not base64!", userId));
        assertThatIllegalStateException().isThrownBy(() -> cipher.decrypt("v2:" + stored.substring(3), userId));
    }

    @Test
    void shouldRefuseAKeyOfTheWrongSize() {
        String shortKey = Base64.getEncoder().encodeToString(new byte[16]);

        assertThatIllegalStateException().isThrownBy(() -> new TotpSecretCipher(shortKey));
        assertThatIllegalStateException().isThrownBy(() -> new TotpSecretCipher(""));
        assertThatIllegalStateException().isThrownBy(() -> new TotpSecretCipher("not base64!"));
    }
}
