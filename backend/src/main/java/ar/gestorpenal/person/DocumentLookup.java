package ar.gestorpenal.person;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * How a document number is stored and matched. Numbers are stored normalized: uppercase, without
 * spaces, dots or hyphens. A DNI also appears inside the 11 digits of a CUIT or CUIL (two digits of
 * type, the DNI padded to eight digits, one check digit), so the two are treated as the same person.
 *
 * @param numbers exact normalized numbers to look for
 * @param embeddedDni eight digits that must equal digits 3 to 10 of an 11-digit number, or empty
 */
record DocumentLookup(List<String> numbers, String embeddedDni) {

    private static final Pattern SEPARATORS = Pattern.compile("[\\s.\\-]");
    private static final Pattern DNI = Pattern.compile("\\d{7,8}");
    private static final Pattern CUIT_OR_CUIL = Pattern.compile("\\d{11}");
    private static final int DNI_START = 2;
    private static final int DNI_LENGTH = 8;

    static String normalize(String number) {
        return SEPARATORS.matcher(number.strip()).replaceAll("").toUpperCase(Locale.ROOT);
    }

    /** The lookup for a number, which may still carry separators. */
    static DocumentLookup of(String number) {
        String normalized = normalize(number);
        List<String> numbers = new ArrayList<>(List.of(normalized));
        if (DNI.matcher(normalized).matches()) {
            return new DocumentLookup(numbers, "0".repeat(DNI_LENGTH - normalized.length()) + normalized);
        }
        if (CUIT_OR_CUIL.matcher(normalized).matches()) {
            String dni = normalized.substring(DNI_START, DNI_START + DNI_LENGTH);
            numbers.add(dni);
            if (dni.startsWith("0")) {
                numbers.add(dni.substring(1));
            }
        }
        return new DocumentLookup(numbers, "");
    }
}
