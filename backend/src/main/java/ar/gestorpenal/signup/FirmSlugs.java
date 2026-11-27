package ar.gestorpenal.signup;

import java.text.Normalizer;
import java.util.Locale;

/**
 * The slug a signed-up firm gets from its name: what its members type as "estudio" at login. The same
 * format as the {@code tenant_slug_format_ck} constraint, short enough to take a {@code -NN} suffix when
 * the name is already in use.
 */
final class FirmSlugs {

    static final int MAX_BASE_LENGTH = 50;
    private static final String FALLBACK = "estudio";

    private FirmSlugs() {}

    /** "Estudio Peña & Asociados" becomes "estudio-pena-asociados". */
    static String fromName(String firmName) {
        String plain = Normalizer.normalize(firmName, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (plain.length() > MAX_BASE_LENGTH) {
            plain = plain.substring(0, MAX_BASE_LENGTH).replaceAll("-+$", "");
        }
        return plain.isEmpty() ? FALLBACK : plain;
    }
}
