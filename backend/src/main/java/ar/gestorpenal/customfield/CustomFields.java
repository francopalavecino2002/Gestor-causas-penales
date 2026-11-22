package ar.gestorpenal.customfield;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.UnaryOperator;
import org.springframework.stereotype.Component;

/**
 * What cases and defendants need from custom fields (ADR-0018): validating the values a request
 * brings and showing only the values of active fields. Call it inside a tenant and a transaction.
 */
@Component
public class CustomFields {

    private final CustomFieldDefinitionRepository definitions;

    CustomFields(CustomFieldDefinitionRepository definitions) {
        this.definitions = definitions;
    }

    /**
     * The values to store for an existing record. {@code incoming == null} keeps {@code current}
     * untouched; otherwise the incoming values replace those of the active fields, see
     * {@link CustomFieldValues#resolve}.
     *
     * @throws InvalidCustomFieldValueException when the values do not fit the firm's definitions
     */
    public Map<String, Object> resolve(
            CustomFieldEntity entity, Map<String, Object> incoming, Map<String, Object> current) {
        return CustomFieldValues.resolve(definitionsOf(entity), incoming, current);
    }

    /** The values to store for a new record: no values at all is an empty map, so required fields apply. */
    public Map<String, Object> resolveNew(CustomFieldEntity entity, Map<String, Object> incoming) {
        return resolve(entity, incoming == null ? Map.of() : incoming, Map.of());
    }

    /**
     * Keeps only the values of active fields, in the fields' display order. It reads the definitions
     * once, so a list of records can share it.
     */
    public UnaryOperator<Map<String, Object>> visibility(CustomFieldEntity entity) {
        List<String> activeKeys = definitionsOf(entity).stream()
                .filter(definition -> !definition.isArchived())
                .map(CustomFieldDefinition::getFieldKey)
                .toList();
        return stored -> {
            Map<String, Object> visible = new LinkedHashMap<>();
            activeKeys.stream()
                    .filter(stored::containsKey)
                    .forEach(key -> visible.put(key, stored.get(key)));
            return visible;
        };
    }

    private List<CustomFieldDefinition> definitionsOf(CustomFieldEntity entity) {
        return definitions.findByEntityTypeOrderByPositionAscCreatedAtAscIdAsc(entity);
    }
}
