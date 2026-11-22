package ar.gestorpenal.customfield;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A custom field definition as the API shows it. */
record CustomFieldView(
        UUID id,
        CustomFieldEntity entity,
        String key,
        String label,
        CustomFieldType type,
        boolean required,
        int position,
        List<CustomFieldOption> options,
        boolean archived,
        Instant createdAt) {

    static CustomFieldView of(CustomFieldDefinition definition) {
        return new CustomFieldView(
                definition.getId(),
                definition.getEntityType(),
                definition.getFieldKey(),
                definition.getLabel(),
                definition.getType(),
                definition.isRequired(),
                definition.getPosition(),
                List.copyOf(definition.getOptions()),
                definition.isArchived(),
                definition.getCreatedAt());
    }
}
