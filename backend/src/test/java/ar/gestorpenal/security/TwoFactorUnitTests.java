package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TwoFactorUnitTests {

    @Test
    void shouldNormalizeRecoveryCodesAsUsersTypeThem() {
        assertThat(TwoFactorService.normalizeRecoveryCode("abcd-1234-efgh-5678")).hasValue("ABCD1234EFGH5678");
        assertThat(TwoFactorService.normalizeRecoveryCode(" ABCD 1234 EFGH 5678 ")).hasValue("ABCD1234EFGH5678");
        // Crockford's base32 reads O as 0 and I, L as 1.
        assertThat(TwoFactorService.normalizeRecoveryCode("ABCD-O234-EFGH-5678")).hasValue("ABCD0234EFGH5678");
        assertThat(TwoFactorService.normalizeRecoveryCode("ABCD-I234-EFGH-L678")).hasValue("ABCD1234EFGH1678");
    }

    @Test
    void shouldRejectRecoveryCodesOfTheWrongShape() {
        assertThat(TwoFactorService.normalizeRecoveryCode("ABCD-1234-EFGH")).isEmpty();
        assertThat(TwoFactorService.normalizeRecoveryCode("ABCD-1234-EFGH-56789")).isEmpty();
        // U is not part of Crockford's base32.
        assertThat(TwoFactorService.normalizeRecoveryCode("ABCD-1234-EFGH-567U")).isEmpty();
    }

    @Test
    void shouldExpireThePendingLoginAtItsDeadline() {
        Instant deadline = Instant.parse("2026-01-01T10:05:00Z");
        PendingSecondFactor pending = new PendingSecondFactor(UUID.randomUUID(), UUID.randomUUID(), "k", deadline);

        assertThat(pending.isExpiredAt(deadline.minusSeconds(1))).isFalse();
        assertThat(pending.isExpiredAt(deadline)).isTrue();
    }
}
