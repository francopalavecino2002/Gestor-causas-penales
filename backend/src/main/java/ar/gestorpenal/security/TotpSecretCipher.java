package ar.gestorpenal.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Encrypts TOTP secrets at rest with AES-256-GCM (ADR-0009). The key comes from configuration, never
 * from the database, so a leaked dump does not reveal the secrets. The user id is authenticated
 * data: a ciphertext copied to another user's row does not decrypt.
 *
 * <p>Stored format: {@code v1:} + base64(12-byte nonce + ciphertext with tag).
 */
@Component
class TotpSecretCipher {

    private static final String VERSION = "v1:";
    private static final int KEY_BYTES = 32;
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    TotpSecretCipher(@Value("${app.security.two-factor.encryption-key}") String base64Key) {
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64Key.strip());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.security.two-factor.encryption-key must be base64", e);
        }
        if (raw.length != KEY_BYTES) {
            throw new IllegalStateException(
                    "app.security.two-factor.encryption-key must decode to " + KEY_BYTES + " bytes");
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    String encrypt(byte[] secret, UUID userId) {
        byte[] nonce = new byte[NONCE_BYTES];
        random.nextBytes(nonce);
        byte[] ciphertext = run(Cipher.ENCRYPT_MODE, nonce, userId, secret);
        byte[] stored = ByteBuffer.allocate(NONCE_BYTES + ciphertext.length).put(nonce).put(ciphertext).array();
        return VERSION + Base64.getEncoder().encodeToString(stored);
    }

    /** @throws IllegalStateException if the value was not encrypted with this key for this user */
    byte[] decrypt(String stored, UUID userId) {
        if (!stored.startsWith(VERSION)) {
            throw new IllegalStateException("Unknown TOTP secret format");
        }
        byte[] data;
        try {
            data = Base64.getDecoder().decode(stored.substring(VERSION.length()));
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Corrupt TOTP secret", e);
        }
        if (data.length < NONCE_BYTES + TAG_BITS / 8) {
            throw new IllegalStateException("Corrupt TOTP secret");
        }
        byte[] nonce = new byte[NONCE_BYTES];
        System.arraycopy(data, 0, nonce, 0, NONCE_BYTES);
        byte[] ciphertext = new byte[data.length - NONCE_BYTES];
        System.arraycopy(data, NONCE_BYTES, ciphertext, 0, ciphertext.length);
        return run(Cipher.DECRYPT_MODE, nonce, userId, ciphertext);
    }

    private byte[] run(int mode, byte[] nonce, UUID userId, byte[] input) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(mode, key, new GCMParameterSpec(TAG_BITS, nonce));
            cipher.updateAAD(userId.toString().getBytes(StandardCharsets.US_ASCII));
            return cipher.doFinal(input);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not process the TOTP secret", e);
        }
    }
}
