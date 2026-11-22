package ar.gestorpenal.customfield;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** The value rules of custom fields, without a database. */
class CustomFieldValuesTests {

    @Test
    void textShouldBeTrimmedAndBlankTextRemoved() {
        List<CustomFieldDefinition> definitions = List.of(field("Notas", CustomFieldType.TEXT, false));

        assertThat(resolve(definitions, values("notas", "  Cliente de confianza  "), Map.of()))
                .containsExactly(Map.entry("notas", "Cliente de confianza"));
        assertThat(resolve(definitions, values("notas", "   "), Map.of())).isEmpty();
    }

    @Test
    void textShouldBeATextOfAtMostOneThousandCharacters() {
        List<CustomFieldDefinition> definitions = List.of(field("Notas", CustomFieldType.TEXT, false));

        assertThat(resolve(definitions, values("notas", "a".repeat(1000)), Map.of())).hasSize(1);
        assertInvalid(definitions, values("notas", "a".repeat(1001)), "'notas'");
        assertInvalid(definitions, values("notas", 12), "'notas'");
    }

    @Test
    void numberShouldAcceptJsonNumbersAndStoreThemAsPlainDecimals() {
        List<CustomFieldDefinition> definitions = List.of(field("Monto", CustomFieldType.NUMBER, false));

        assertThat(resolve(definitions, values("monto", 150000), Map.of()))
                .containsExactly(Map.entry("monto", new BigDecimal("150000")));
        assertThat(resolve(definitions, values("monto", 5.50), Map.of()))
                .containsExactly(Map.entry("monto", new BigDecimal("5.5")));
        assertThat(resolve(definitions, values("monto", new BigDecimal("1E+3")), Map.of()))
                .containsExactly(Map.entry("monto", new BigDecimal("1000")));
    }

    @Test
    void numberShouldHaveAtMostFifteenSignificantDigitsSoADoubleReadsItBackExactly() {
        List<CustomFieldDefinition> definitions = List.of(field("Monto", CustomFieldType.NUMBER, false));

        assertThat(resolve(definitions, values("monto", new BigDecimal("1234567890123.45")), Map.of()))
                .containsExactly(Map.entry("monto", new BigDecimal("1234567890123.45")));
        assertThat(resolve(definitions, values("monto", 0.0000001), Map.of()))
                .containsExactly(Map.entry("monto", new BigDecimal("1E-7")));
        assertInvalid(definitions, values("monto", new BigDecimal("12345678901234567.89")), "significant digits");
    }

    @Test
    void numberShouldRejectTextBooleansAndNotANumber() {
        List<CustomFieldDefinition> definitions = List.of(field("Monto", CustomFieldType.NUMBER, false));

        assertInvalid(definitions, values("monto", "150000"), "'monto'");
        assertInvalid(definitions, values("monto", true), "'monto'");
        assertInvalid(definitions, values("monto", Double.NaN), "'monto'");
        assertInvalid(definitions, values("monto", Double.POSITIVE_INFINITY), "'monto'");
    }

    @Test
    void dateShouldBeAnIsoDay() {
        List<CustomFieldDefinition> definitions = List.of(field("Fecha", CustomFieldType.DATE, false));

        assertThat(resolve(definitions, values("fecha", "2026-03-09"), Map.of()))
                .containsExactly(Map.entry("fecha", "2026-03-09"));
        assertInvalid(definitions, values("fecha", "09/03/2026"), "'fecha'");
        assertInvalid(definitions, values("fecha", "2026-02-30"), "'fecha'");
        assertInvalid(definitions, values("fecha", 20260309), "'fecha'");
    }

    @Test
    void booleanShouldBeTrueOrFalse() {
        List<CustomFieldDefinition> definitions = List.of(field("Activo", CustomFieldType.BOOLEAN, false));

        assertThat(resolve(definitions, values("activo", false), Map.of()))
                .containsExactly(Map.entry("activo", false));
        assertInvalid(definitions, values("activo", "true"), "'activo'");
        assertInvalid(definitions, values("activo", 1), "'activo'");
    }

    @Test
    void listShouldBeTheCodeOfAVisibleOption() {
        List<CustomFieldDefinition> definitions = List.of(listField());

        assertThat(resolve(definitions, values("prioridad", "alta"), Map.of()))
                .containsExactly(Map.entry("prioridad", "alta"));
        assertInvalid(definitions, values("prioridad", "urgente"), "'prioridad'");
        assertInvalid(definitions, values("prioridad", "Alta"), "'prioridad'");
        assertInvalid(definitions, values("prioridad", 1), "'prioridad'");
    }

    @Test
    void aHiddenOptionShouldBeKeptWhereItIsStoredButNotChosenAnew() {
        CustomFieldDefinition priority = listField();
        priority.change("Prioridad", false, 0, List.of(
                new CustomFieldDefinition.OptionChange("alta", "Alta", true),
                new CustomFieldDefinition.OptionChange("media", "Media", false)));
        List<CustomFieldDefinition> definitions = List.of(priority);

        assertThat(resolve(definitions, values("prioridad", "alta"), values("prioridad", "alta")))
                .containsExactly(Map.entry("prioridad", "alta"));
        assertInvalid(definitions, values("prioridad", "alta"), "'prioridad'");
        assertInvalid(definitions, values("prioridad", "alta"), "hidden");
        assertThat(resolve(definitions, values("prioridad", "media"), values("prioridad", "alta")))
                .containsExactly(Map.entry("prioridad", "media"));
    }

    @Test
    void aNullValueOrAMissingKeyShouldClearTheField() {
        List<CustomFieldDefinition> definitions = List.of(
                field("Notas", CustomFieldType.TEXT, false), field("Monto", CustomFieldType.NUMBER, false));
        Map<String, Object> current = values("notas", "algo", "monto", new BigDecimal("10"));

        assertThat(resolve(definitions, values("notas", null, "monto", 10), current))
                .containsExactly(Map.entry("monto", new BigDecimal("10")));
        assertThat(resolve(definitions, values("monto", 20), current))
                .containsExactly(Map.entry("monto", new BigDecimal("20")));
        assertThat(resolve(definitions, Map.of(), current)).isEmpty();
    }

    @Test
    void noIncomingValuesShouldKeepTheStoredOnesEvenIfAFieldBecameRequired() {
        List<CustomFieldDefinition> definitions = List.of(
                field("Notas", CustomFieldType.TEXT, true), field("Monto", CustomFieldType.NUMBER, true));
        Map<String, Object> current = values("notas", "algo");

        assertThat(CustomFieldValues.resolve(definitions, null, current)).isEqualTo(current);
        assertThat(CustomFieldValues.resolve(definitions, null, null)).isEmpty();
    }

    @Test
    void aRequiredFieldShouldNeedAValue() {
        List<CustomFieldDefinition> definitions = List.of(field("Notas", CustomFieldType.TEXT, true));

        assertInvalid(definitions, Map.of(), "'notas' is required");
        assertInvalid(definitions, values("notas", null), "'notas' is required");
        assertInvalid(definitions, values("notas", "  "), "'notas' is required");
        assertThat(resolve(definitions, values("notas", "ok"), Map.of())).hasSize(1);
    }

    @Test
    void anUnknownOrArchivedKeyShouldBeRejectedNamingIt() {
        CustomFieldDefinition archived = field("Viejo", CustomFieldType.TEXT, false);
        archived.archive();
        List<CustomFieldDefinition> definitions = List.of(field("Notas", CustomFieldType.TEXT, false), archived);

        assertInvalid(definitions, values("desconocido", "x"), "'desconocido'");
        assertInvalid(definitions, values("viejo", "x"), "'viejo'");
    }

    @Test
    void valuesOfAnArchivedFieldShouldBePreserved() {
        CustomFieldDefinition archived = field("Viejo", CustomFieldType.TEXT, true);
        archived.archive();
        List<CustomFieldDefinition> definitions = List.of(field("Notas", CustomFieldType.TEXT, false), archived);
        Map<String, Object> current = values("viejo", "dato guardado", "notas", "a");

        Map<String, Object> result = resolve(definitions, values("notas", "b"), current);

        assertThat(result).containsEntry("viejo", "dato guardado").containsEntry("notas", "b");
    }

    private static Map<String, Object> resolve(
            List<CustomFieldDefinition> definitions, Map<String, Object> incoming, Map<String, Object> current) {
        return CustomFieldValues.resolve(definitions, incoming, current);
    }

    private static void assertInvalid(
            List<CustomFieldDefinition> definitions, Map<String, Object> incoming, String messagePart) {
        assertThatThrownBy(() -> resolve(definitions, incoming, Map.of()))
                .isInstanceOf(InvalidCustomFieldValueException.class)
                .hasMessageContaining(messagePart);
    }

    private static CustomFieldDefinition field(String label, CustomFieldType type, boolean required) {
        return CustomFieldDefinition.create(CustomFieldEntity.CASE_FILE, label, type, required, List.of(), 0, Set.of());
    }

    private static CustomFieldDefinition listField() {
        return CustomFieldDefinition.create(
                CustomFieldEntity.CASE_FILE, "Prioridad", CustomFieldType.LIST, false, List.of("Alta", "Media"), 0, Set.of());
    }

    /** A mutable map in insertion order that accepts {@code null} values, from alternating keys and values. */
    private static Map<String, Object> values(Object... keysAndValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            map.put((String) keysAndValues[i], keysAndValues[i + 1]);
        }
        return map;
    }
}
