package ar.gestorpenal.user;

import java.security.SecureRandom;

/**
 * Temporary passwords the owner reads to a new colleague: four groups of four characters from an
 * alphabet without look-alikes (no 0/O, 1/l/I), about 90 bits of randomness. The user must replace
 * it at the first login (ADR-0044).
 */
final class TemporaryPasswords {

    static final String ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY2346789";
    private static final int GROUPS = 4;
    private static final int GROUP_LENGTH = 4;

    private final SecureRandom random = new SecureRandom();

    String next() {
        StringBuilder password = new StringBuilder(GROUPS * (GROUP_LENGTH + 1));
        for (int group = 0; group < GROUPS; group++) {
            if (group > 0) {
                password.append('-');
            }
            for (int i = 0; i < GROUP_LENGTH; i++) {
                password.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            }
        }
        return password.toString();
    }
}
