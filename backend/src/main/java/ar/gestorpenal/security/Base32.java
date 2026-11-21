package ar.gestorpenal.security;

import java.util.Locale;

/**
 * RFC 4648 base32 without padding, the format authenticator apps expect for TOTP secrets.
 * Decoding ignores spaces and case, because users may type the secret by hand.
 */
final class Base32 {

    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private Base32() {}

    static String encode(byte[] data) {
        StringBuilder out = new StringBuilder((data.length * 8 + 4) / 5);
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bits += 8;
            while (bits >= 5) {
                out.append(ALPHABET.charAt((buffer >> (bits - 5)) & 0x1F));
                bits -= 5;
            }
        }
        if (bits > 0) {
            out.append(ALPHABET.charAt((buffer << (5 - bits)) & 0x1F));
        }
        return out.toString();
    }

    /** @throws IllegalArgumentException if the text has characters outside the alphabet */
    static byte[] decode(String text) {
        String clean = text.replace(" ", "").replace("=", "").toUpperCase(Locale.ROOT);
        byte[] out = new byte[clean.length() * 5 / 8];
        int buffer = 0;
        int bits = 0;
        int index = 0;
        for (int i = 0; i < clean.length(); i++) {
            int value = ALPHABET.indexOf(clean.charAt(i));
            if (value < 0) {
                throw new IllegalArgumentException("Not a base32 character at position " + i);
            }
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8) {
                out[index++] = (byte) (buffer >> (bits - 8));
                bits -= 8;
            }
        }
        return out;
    }
}
