package ar.gestorpenal.customfield;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A field a firm added to its cases or defendants (ADR-0018). The entity, key and type never change,
 * so the values stored under the key stay valid; the label, position, required flag and options can.
 * Archived, never deleted: an archived definition keeps the values already stored.
 */
@Entity
@Audited
@Table(name = "custom_field_definition")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class CustomFieldDefinition extends TenantScopedEntity {

    static final int MAX_LABEL_LENGTH = 100;
    static final int MAX_OPTIONS = 100;

    private static final String KEY_FALLBACK = "campo";
    private static final String OPTION_CODE_FALLBACK = "opcion";

    /**
     * An option as the owner sends it when editing a field: no code means a new option. {@code hidden}
     * null keeps the option as it is (a new option is visible), so a client that omits it never
     * shows a hidden option again by accident.
     */
    record OptionChange(String code, String label, Boolean hidden) {}

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity", nullable = false, updatable = false, length = 20)
    private CustomFieldEntity entityType;

    @Column(name = "field_key", nullable = false, updatable = false, length = CustomFieldSlug.MAX_LENGTH)
    private String fieldKey;

    @Column(nullable = false, length = MAX_LABEL_LENGTH)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(name = "field_type", nullable = false, updatable = false, length = 20)
    private CustomFieldType type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<CustomFieldOption> options = new ArrayList<>();

    @Column(nullable = false)
    private boolean required;

    @Column(nullable = false)
    private int position;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    /**
     * A new field. Its key comes from the label and avoids {@code takenKeys}, which must hold the keys
     * of every field of the firm for that record, archived ones included.
     */
    static CustomFieldDefinition create(
            CustomFieldEntity entityType,
            String label,
            CustomFieldType type,
            boolean required,
            List<String> optionLabels,
            int position,
            Set<String> takenKeys) {
        String cleanLabel = requireLabel(label);
        CustomFieldDefinition definition = new CustomFieldDefinition();
        definition.entityType = entityType;
        definition.fieldKey = CustomFieldSlug.uniqueOf(cleanLabel, KEY_FALLBACK, takenKeys);
        definition.label = cleanLabel;
        definition.type = type;
        definition.options = newOptions(type, optionLabels);
        definition.required = required;
        definition.position = requirePosition(position);
        definition.createdAt = Instant.now();
        return definition;
    }

    /**
     * Changes what can change. {@code requested} lists every option: those with a code update that
     * option, those without are added, and an existing option that is missing is rejected. The
     * validation runs before anything is assigned.
     */
    void change(String newLabel, boolean newRequired, int newPosition, List<OptionChange> requested) {
        String cleanLabel = requireLabel(newLabel);
        int checkedPosition = requirePosition(newPosition);
        List<CustomFieldOption> newOptions = changedOptions(requested);

        this.label = cleanLabel;
        this.required = newRequired;
        this.position = checkedPosition;
        this.options = newOptions;
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }

    void restore() {
        archivedAt = null;
    }

    private static List<CustomFieldOption> newOptions(CustomFieldType type, List<String> optionLabels) {
        List<String> labels = optionLabels == null ? List.of() : optionLabels;
        if (type != CustomFieldType.LIST) {
            requireNoOptions(labels.size());
            return new ArrayList<>();
        }
        Set<String> codes = new HashSet<>();
        List<CustomFieldOption> options = new ArrayList<>();
        for (String optionLabel : labels) {
            String cleanLabel = requireOptionLabel(optionLabel);
            String code = CustomFieldSlug.uniqueOf(cleanLabel, OPTION_CODE_FALLBACK, codes);
            codes.add(code);
            options.add(new CustomFieldOption(code, cleanLabel, false));
        }
        requireListShape(options);
        return options;
    }

    private List<CustomFieldOption> changedOptions(List<OptionChange> requested) {
        List<OptionChange> changes = requested == null ? List.of() : requested;
        if (type != CustomFieldType.LIST) {
            requireNoOptions(changes.size());
            return new ArrayList<>();
        }
        Map<String, CustomFieldOption> existing = new LinkedHashMap<>();
        options.forEach(option -> existing.put(option.code(), option));
        Set<String> usedCodes = new HashSet<>(existing.keySet());
        Set<String> keptCodes = new HashSet<>();
        List<CustomFieldOption> result = new ArrayList<>();
        for (OptionChange change : changes) {
            String cleanLabel = requireOptionLabel(change.label());
            if (change.code() == null || change.code().isBlank()) {
                String code = CustomFieldSlug.uniqueOf(cleanLabel, OPTION_CODE_FALLBACK, usedCodes);
                usedCodes.add(code);
                result.add(new CustomFieldOption(code, cleanLabel, Boolean.TRUE.equals(change.hidden())));
                continue;
            }
            if (!existing.containsKey(change.code())) {
                throw new InvalidCustomFieldDefinitionException("The field has no option '" + change.code() + "'");
            }
            if (!keptCodes.add(change.code())) {
                throw new InvalidCustomFieldDefinitionException("The option '" + change.code() + "' is listed twice");
            }
            boolean hidden = change.hidden() == null ? existing.get(change.code()).hidden() : change.hidden();
            result.add(new CustomFieldOption(change.code(), cleanLabel, hidden));
        }
        if (!keptCodes.containsAll(existing.keySet())) {
            throw new InvalidCustomFieldDefinitionException("An option cannot be removed: hide it instead");
        }
        requireListShape(result);
        return result;
    }

    private static void requireNoOptions(int count) {
        if (count > 0) {
            throw new InvalidCustomFieldDefinitionException("Only a list field has options");
        }
    }

    private static void requireListShape(List<CustomFieldOption> options) {
        if (options.size() > MAX_OPTIONS) {
            throw new InvalidCustomFieldDefinitionException("A list field has at most " + MAX_OPTIONS + " options");
        }
        if (options.stream().allMatch(CustomFieldOption::hidden)) {
            throw new InvalidCustomFieldDefinitionException("A list field needs at least one visible option");
        }
    }

    private static String requireLabel(String label) {
        return requireText(label, "The field needs a label", "The label");
    }

    private static String requireOptionLabel(String label) {
        return requireText(label, "An option needs a label", "The option label");
    }

    private static String requireText(String text, String missingMessage, String subject) {
        if (text == null || text.isBlank()) {
            throw new InvalidCustomFieldDefinitionException(missingMessage);
        }
        String stripped = text.strip();
        if (stripped.length() > MAX_LABEL_LENGTH) {
            throw new InvalidCustomFieldDefinitionException(subject + " has at most " + MAX_LABEL_LENGTH + " characters");
        }
        return stripped;
    }

    private static int requirePosition(int position) {
        if (position < 0) {
            throw new InvalidCustomFieldDefinitionException("The position cannot be negative");
        }
        return position;
    }
}
