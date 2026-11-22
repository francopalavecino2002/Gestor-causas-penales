package ar.gestorpenal.customfield;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The custom field definitions of the current firm (ADR-0018). The caller must be inside a tenant;
 * the repository only sees the firm's rows, so another firm's id is "not found". Who may change
 * definitions is decided by the controller.
 */
@Service
class CustomFieldService {

    static final int MAX_ACTIVE_PER_ENTITY = 50;

    private final CustomFieldDefinitionRepository definitions;

    CustomFieldService(CustomFieldDefinitionRepository definitions) {
        this.definitions = definitions;
    }

    @Transactional(readOnly = true)
    List<CustomFieldView> list(CustomFieldEntity entity, boolean includeArchived) {
        return definitions.findByEntityTypeOrderByPositionAscCreatedAtAscIdAsc(entity).stream()
                .filter(definition -> includeArchived || !definition.isArchived())
                .map(CustomFieldView::of)
                .toList();
    }

    @Transactional(readOnly = true)
    CustomFieldView get(UUID id) {
        return CustomFieldView.of(find(id));
    }

    /** Adds a field after the last one. Its key comes from the label. */
    @Transactional
    CustomFieldView create(
            CustomFieldEntity entity, String label, CustomFieldType type, boolean required, List<String> optionLabels) {
        requireRoomFor(entity);
        List<CustomFieldDefinition> existing = definitions.findByEntityTypeOrderByPositionAscCreatedAtAscIdAsc(entity);
        Set<String> takenKeys = existing.stream().map(CustomFieldDefinition::getFieldKey).collect(Collectors.toSet());
        int position = existing.stream().mapToInt(CustomFieldDefinition::getPosition).max().orElse(-1) + 1;
        return CustomFieldView.of(definitions.saveAndFlush(
                CustomFieldDefinition.create(entity, label, type, required, optionLabels, position, takenKeys)));
    }

    @Transactional
    CustomFieldView update(
            UUID id, String label, boolean required, int position, List<CustomFieldDefinition.OptionChange> options) {
        CustomFieldDefinition definition = find(id);
        if (definition.isArchived()) {
            throw new InvalidCustomFieldDefinitionException("An archived field cannot be changed: restore it first");
        }
        definition.change(label, required, position, options);
        return CustomFieldView.of(definition);
    }

    @Transactional
    void archive(UUID id) {
        find(id).archive();
    }

    @Transactional
    void restore(UUID id) {
        CustomFieldDefinition definition = find(id);
        if (definition.isArchived()) {
            requireRoomFor(definition.getEntityType());
        }
        definition.restore();
    }

    private void requireRoomFor(CustomFieldEntity entity) {
        if (definitions.countByEntityTypeAndArchivedAtIsNull(entity) >= MAX_ACTIVE_PER_ENTITY) {
            throw new InvalidCustomFieldDefinitionException(
                    "A firm can have at most " + MAX_ACTIVE_PER_ENTITY + " active custom fields per record");
        }
    }

    private CustomFieldDefinition find(UUID id) {
        return definitions.findById(id)
                .orElseThrow(() -> new CustomFieldNotFoundException("There is no custom field " + id));
    }
}
