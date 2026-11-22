package ar.gestorpenal.customfield;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Validates the custom field values of a record against the firm's definitions (ADR-0018). The
 * database cannot do it: values live in a jsonb column keyed by the definition's key.
 */
final class CustomFieldValues {

    static final int MAX_TEXT_LENGTH = 1000;
    static final int MAX_NUMBER_DIGITS = 15;

    private CustomFieldValues() {}

    /**
     * The map to store after a request.
     *
     * <p>No incoming values ({@code null}) keep the stored ones untouched, so a field made required
     * later never breaks an unrelated edit. Otherwise the incoming values replace the ones of the
     * active definitions: a field that is absent or {@code null} is cleared. Values of archived
     * definitions are kept as they are, so restoring the definition brings the data back.
     *
     * @param definitions every definition of the record, archived ones included
     * @throws InvalidCustomFieldValueException when a key is not an active field, a value does not fit
     *     its type, or a required field has no value
     */
    static Map<String, Object> resolve(
            List<CustomFieldDefinition> definitions, Map<String, Object> incoming, Map<String, Object> current) {
        Map<String, Object> stored = current == null ? Map.of() : current;
        if (incoming == null) {
            return new LinkedHashMap<>(stored);
        }
        Map<String, CustomFieldDefinition> active = new LinkedHashMap<>();
        definitions.stream().filter(definition -> !definition.isArchived())
                .forEach(definition -> active.put(definition.getFieldKey(), definition));
        for (String key : incoming.keySet()) {
            if (!active.containsKey(key)) {
                throw new InvalidCustomFieldValueException("There is no active custom field '" + key + "'");
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        definitions.stream()
                .filter(CustomFieldDefinition::isArchived)
                .filter(definition -> stored.containsKey(definition.getFieldKey()))
                .forEach(definition -> result.put(definition.getFieldKey(), stored.get(definition.getFieldKey())));
        for (CustomFieldDefinition definition : active.values()) {
            String key = definition.getFieldKey();
            Object value = normalize(definition, incoming.get(key), stored.get(key));
            if (value != null) {
                result.put(key, value);
            } else if (definition.isRequired()) {
                throw new InvalidCustomFieldValueException("The custom field '" + key + "' is required");
            }
        }
        return result;
    }

    /** The value to store, or {@code null} when the field is cleared (no value, or blank text). */
    private static Object normalize(CustomFieldDefinition definition, Object raw, Object storedValue) {
        if (raw == null) {
            return null;
        }
        return switch (definition.getType()) {
            case TEXT -> text(definition, raw);
            case NUMBER -> number(definition, raw);
            case DATE -> date(definition, raw);
            case BOOLEAN -> bool(definition, raw);
            case LIST -> option(definition, raw, storedValue);
        };
    }

    private static String text(CustomFieldDefinition definition, Object raw) {
        if (!(raw instanceof String text)) {
            throw invalid(definition, "must be text");
        }
        String stripped = text.strip();
        if (stripped.length() > MAX_TEXT_LENGTH) {
            throw invalid(definition, "has at most " + MAX_TEXT_LENGTH + " characters");
        }
        return stripped.isEmpty() ? null : stripped;
    }

    /**
     * Stored as a plain decimal: {@code 5.50} and {@code 5.5} are the same value. At most
     * {@value #MAX_NUMBER_DIGITS} significant digits, which a JSON reader that uses doubles keeps exactly.
     */
    private static BigDecimal number(CustomFieldDefinition definition, Object raw) {
        if (!(raw instanceof Number number) || !Double.isFinite(number.doubleValue())) {
            throw invalid(definition, "must be a number");
        }
        BigDecimal decimal;
        try {
            decimal = canonical(number);
        } catch (NumberFormatException exception) {
            throw invalid(definition, "must be a number");
        }
        if (decimal.precision() > MAX_NUMBER_DIGITS) {
            throw invalid(definition, "has at most " + MAX_NUMBER_DIGITS + " significant digits");
        }
        return decimal;
    }

    /** The same decimal for every form of a number: {@code 100}, {@code 100.0} and {@code 1E+2} included. */
    static BigDecimal canonical(Number number) {
        BigDecimal decimal = new BigDecimal(number.toString()).stripTrailingZeros();
        return decimal.scale() < 0 ? decimal.setScale(0) : decimal;
    }

    private static String date(CustomFieldDefinition definition, Object raw) {
        if (!(raw instanceof String text)) {
            throw invalid(definition, "must be a date written yyyy-MM-dd");
        }
        try {
            return LocalDate.parse(text.strip()).toString();
        } catch (DateTimeParseException exception) {
            throw invalid(definition, "must be a date written yyyy-MM-dd");
        }
    }

    private static Boolean bool(CustomFieldDefinition definition, Object raw) {
        if (!(raw instanceof Boolean value)) {
            throw invalid(definition, "must be true or false");
        }
        return value;
    }

    /** A hidden option is still accepted when the record already holds it: hiding is not a data change. */
    private static String option(CustomFieldDefinition definition, Object raw, Object storedValue) {
        if (!(raw instanceof String code)) {
            throw invalid(definition, "must be the code of one of its options");
        }
        CustomFieldOption option = definition.getOptions().stream()
                .filter(candidate -> candidate.code().equals(code))
                .findFirst()
                .orElseThrow(() -> invalid(definition, "has no option '" + code + "'"));
        if (option.hidden() && !Objects.equals(storedValue, code)) {
            throw invalid(definition, "has no option '" + code + "' to choose: it is hidden");
        }
        return code;
    }

    private static InvalidCustomFieldValueException invalid(CustomFieldDefinition definition, String problem) {
        return new InvalidCustomFieldValueException("The custom field '" + definition.getFieldKey() + "' " + problem);
    }
}
