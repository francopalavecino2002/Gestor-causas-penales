package ar.gestorpenal.casefile;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Legajo of the Ministerio Público Fiscal: {@code MPF}, the seat letters and {@code number/year}, as
 * in {@code MPFNQ 123989/2018}. The list of seats is not validated {@code [validar]}.
 */
final class MpfLegajo {

    private static final Pattern FORMAT = Pattern.compile("^MPF([A-Z]{2,4})\\s*(\\d{1,7})/(\\d{4})$");
    private static final Pattern PREFIX = Pattern.compile("^(MPF[A-Z]{2,4})\\s*(\\d)");

    private MpfLegajo() {}

    /** The canonical form (uppercase, one space after the seat), or {@code null} for blank input. */
    static String normalize(String raw) {
        String text = Text.clean(raw);
        if (text == null) {
            return null;
        }
        Matcher matcher = FORMAT.matcher(text.toUpperCase(Locale.ROOT));
        if (!matcher.matches()) {
            throw new InvalidCaseDataException(
                    "The MPF legajo must look like 'MPFNQ 123989/2018' (MPF, seat letters, number/year)");
        }
        return "MPF" + matcher.group(1) + " " + matcher.group(2) + "/" + matcher.group(3);
    }

    /** Uppercase text for a "contains" search, with the space after the seat restored if it is missing. */
    static String searchForm(String raw) {
        String text = raw.strip().toUpperCase(Locale.ROOT);
        return PREFIX.matcher(text).replaceFirst("$1 $2");
    }
}
