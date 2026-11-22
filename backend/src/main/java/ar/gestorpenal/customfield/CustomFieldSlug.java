package ar.gestorpenal.customfield;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/** Builds the keys of fields and the codes of options from their labels. */
final class CustomFieldSlug {

    static final int MAX_LENGTH = 60;

    private CustomFieldSlug() {}

    /**
     * Lowercase ASCII words joined by hyphens ("Fecha de detención" becomes "fecha-de-detencion"),
     * at most {@link #MAX_LENGTH} characters; {@code fallback} when the label has no letters or digits.
     */
    static String of(String label, String fallback) {
        String ascii = Normalizer.normalize(label, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        String slug = trimHyphens(ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-"));
        if (slug.length() > MAX_LENGTH) {
            slug = trimHyphens(slug.substring(0, MAX_LENGTH));
        }
        return slug.isEmpty() ? fallback : slug;
    }

    /** The slug of the label, or the first of {@code -2}, {@code -3}... variants that is not in {@code taken}. */
    static String uniqueOf(String label, String fallback, Set<String> taken) {
        String base = of(label, fallback);
        String candidate = base;
        for (int number = 2; taken.contains(candidate); number++) {
            String suffix = "-" + number;
            String head = trimHyphens(base.substring(0, Math.min(base.length(), MAX_LENGTH - suffix.length())));
            candidate = head + suffix;
        }
        return candidate;
    }

    private static String trimHyphens(String value) {
        int start = 0;
        int end = value.length();
        while (start < end && value.charAt(start) == '-') {
            start++;
        }
        while (end > start && value.charAt(end - 1) == '-') {
            end--;
        }
        return value.substring(start, end);
    }
}
