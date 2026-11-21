package ar.gestorpenal.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.OptionalLong;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Time-based one-time passwords (RFC 6238) with the parameters every authenticator app supports:
 * HMAC-SHA1, 6 digits, 30-second steps. One step of clock drift is tolerated in each direction.
 */
final class Totp {

    static final int DIGITS = 6;
    static final long STEP_SECONDS = 30;
    static final int ALLOWED_DRIFT_STEPS = 1;
    /** 160 bits, the secret length recommended by RFC 4226. */
    static final int SECRET_BYTES = 20;

    private static final int MODULUS = 1_000_000;

    private Totp() {}

    static long stepAt(Instant instant) {
        return Math.floorDiv(instant.getEpochSecond(), STEP_SECONDS);
    }

    /** The code for one step, zero-padded to {@link #DIGITS} digits (RFC 4226 dynamic truncation). */
    static String codeAt(byte[] secret, long step) {
        byte[] hash = hmacSha1(secret, ByteBuffer.allocate(Long.BYTES).putLong(step).array());
        int offset = hash[hash.length - 1] & 0x0F;
        int binary = ((hash[offset] & 0x7F) << 24)
                | ((hash[offset + 1] & 0xFF) << 16)
                | ((hash[offset + 2] & 0xFF) << 8)
                | (hash[offset + 3] & 0xFF);
        return String.format("%0" + DIGITS + "d", binary % MODULUS);
    }

    /**
     * The step whose code equals {@code code}, within the allowed drift around {@code now}. Every
     * candidate is compared in constant time, so timing does not tell which step matched.
     */
    static OptionalLong matchingStep(byte[] secret, String code, Instant now) {
        if (code.length() != DIGITS || !code.chars().allMatch(Character::isDigit)) {
            return OptionalLong.empty();
        }
        byte[] given = code.getBytes(StandardCharsets.US_ASCII);
        long current = stepAt(now);
        long match = -1;
        for (long step = current - ALLOWED_DRIFT_STEPS; step <= current + ALLOWED_DRIFT_STEPS; step++) {
            byte[] expected = codeAt(secret, step).getBytes(StandardCharsets.US_ASCII);
            // No early exit: every step is compared. The first match wins (codes may repeat).
            if (MessageDigest.isEqual(expected, given) && match < 0) {
                match = step;
            }
        }
        return match < 0 ? OptionalLong.empty() : OptionalLong.of(match);
    }

    private static byte[] hmacSha1(byte[] key, byte[] message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            return mac.doFinal(message);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA1 is required by every Java platform", e);
        }
    }
}
