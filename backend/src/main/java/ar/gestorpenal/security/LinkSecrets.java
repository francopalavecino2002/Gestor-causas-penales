package ar.gestorpenal.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * The secrets of the one-time links sent by email (password recovery, email verification): 256 random
 * bits in unpadded base64url, stored only as their SHA-256 in hex.
 */
final class LinkSecrets {

    private static final int SECRET_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    /** 32 bytes in unpadded base64url. Anything else cannot be a link and is not looked up. */
    private static final Pattern FORMAT = Pattern.compile("[A-Za-z0-9_-]{43}");

    private LinkSecrets() {}

    static String newSecret() {
        byte[] bytes = new byte[SECRET_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static boolean isWellFormed(String secret) {
        return secret != null && FORMAT.matcher(secret).matches();
    }

    static String hash(String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every Java platform", e);
        }
    }
}
