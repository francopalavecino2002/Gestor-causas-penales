package ar.gestorpenal.dataimport;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Text comparison helpers shared by headers, catalog cells and words like "sí". */
final class ImportText {

    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern SPACES = Pattern.compile("\\s+");

    private ImportText() {}

    /** Lowercase, without accents, trimmed, with runs of spaces collapsed: "Formulación  de Cargos" is "formulacion de cargos". */
    static String fold(String text) {
        if (text == null) {
            return "";
        }
        String withoutMarks = MARKS.matcher(Normalizer.normalize(text, Normalizer.Form.NFD)).replaceAll("");
        return SPACES.matcher(withoutMarks.strip().toLowerCase(Locale.ROOT)).replaceAll(" ");
    }

    /** A header as the importers name it: folded, with spaces turned into underscores ("Legajo MPF" is "legajo_mpf"). */
    static String header(String text) {
        return fold(text).replace(' ', '_');
    }
}
