package ar.gestorpenal.customfield;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** The rules of a definition: generated key and codes, and what an edit can and cannot do. */
class CustomFieldDefinitionTests {

    @Test
    void shouldGenerateTheKeyFromTheLabelAvoidingTakenKeys() {
        CustomFieldDefinition first = create("Unidad de detención", CustomFieldType.TEXT, List.of(), Set.of());
        CustomFieldDefinition second =
                create("Unidad de detención", CustomFieldType.TEXT, List.of(), Set.of(first.getFieldKey()));

        assertThat(first.getFieldKey()).isEqualTo("unidad-de-detencion");
        assertThat(second.getFieldKey()).isEqualTo("unidad-de-detencion-2");
    }

    @Test
    void shouldKeepTheKeyWhenTheLabelIsRenamed() {
        CustomFieldDefinition field = create("Honorarios pactados", CustomFieldType.BOOLEAN, List.of(), Set.of());

        field.change("Honorarios acordados", true, 3, List.of());

        assertThat(field.getFieldKey()).isEqualTo("honorarios-pactados");
        assertThat(field.getLabel()).isEqualTo("Honorarios acordados");
        assertThat(field.isRequired()).isTrue();
        assertThat(field.getPosition()).isEqualTo(3);
    }

    @Test
    void shouldGenerateOptionCodesFromTheLabelsAvoidingDuplicates() {
        CustomFieldDefinition field =
                create("Origen", CustomFieldType.LIST, List.of("Sí", "Otro", "otro"), Set.of());

        assertThat(field.getOptions()).extracting(CustomFieldOption::code).containsExactly("si", "otro", "otro-2");
        assertThat(field.getOptions()).extracting(CustomFieldOption::label).containsExactly("Sí", "Otro", "otro");
    }

    @Test
    void aListNeedsAVisibleOptionAndOtherTypesHaveNone() {
        assertInvalid(() -> create("Origen", CustomFieldType.LIST, List.of(), Set.of()));
        assertInvalid(() -> create("Origen", CustomFieldType.LIST, List.of("  "), Set.of()));
        assertInvalid(() -> create("Notas", CustomFieldType.TEXT, List.of("Una"), Set.of()));
    }

    @Test
    void aLabelIsRequiredAndAtMostOneHundredCharacters() {
        assertInvalid(() -> create("  ", CustomFieldType.TEXT, List.of(), Set.of()));
        assertInvalid(() -> create("a".repeat(101), CustomFieldType.TEXT, List.of(), Set.of()));
        assertInvalid(() -> create("Origen", CustomFieldType.LIST, List.of("a".repeat(101)), Set.of()));
        assertThat(create("a".repeat(100), CustomFieldType.TEXT, List.of(), Set.of()).getLabel()).hasSize(100);
    }

    @Test
    void anEditShouldRenameHideAndAddOptionsKeepingTheirCodes() {
        CustomFieldDefinition field = create("Origen", CustomFieldType.LIST, List.of("Alta", "Media"), Set.of());

        field.change("Origen", false, 0, List.of(
                new CustomFieldDefinition.OptionChange("alta", "Prioridad alta", false),
                new CustomFieldDefinition.OptionChange("media", "Media", true),
                new CustomFieldDefinition.OptionChange(null, "Baja", false)));

        assertThat(field.getOptions()).containsExactly(
                new CustomFieldOption("alta", "Prioridad alta", false),
                new CustomFieldOption("media", "Media", true),
                new CustomFieldOption("baja", "Baja", false));
    }

    @Test
    void anOmittedHiddenFlagShouldKeepTheOptionAsItIs() {
        CustomFieldDefinition field = create("Origen", CustomFieldType.LIST, List.of("Alta", "Media"), Set.of());
        field.change("Origen", false, 0, List.of(
                new CustomFieldDefinition.OptionChange("alta", "Alta", true),
                new CustomFieldDefinition.OptionChange("media", "Media", false)));

        field.change("Origen", false, 0, List.of(
                new CustomFieldDefinition.OptionChange("alta", "Alta", null),
                new CustomFieldDefinition.OptionChange("media", "Media", null),
                new CustomFieldDefinition.OptionChange(null, "Baja", null)));

        assertThat(field.getOptions()).containsExactly(
                new CustomFieldOption("alta", "Alta", true),
                new CustomFieldOption("media", "Media", false),
                new CustomFieldOption("baja", "Baja", false));
    }

    @Test
    void anEditCannotRemoveAnOptionOrUseAnUnknownOrRepeatedCode() {
        CustomFieldDefinition field = create("Origen", CustomFieldType.LIST, List.of("Alta", "Media"), Set.of());

        assertInvalid(() -> field.change("Origen", false, 0, List.of(
                new CustomFieldDefinition.OptionChange("alta", "Alta", false))));
        assertInvalid(() -> field.change("Origen", false, 0, List.of(
                new CustomFieldDefinition.OptionChange("alta", "Alta", false),
                new CustomFieldDefinition.OptionChange("media", "Media", false),
                new CustomFieldDefinition.OptionChange("otra", "Otra", false))));
        assertInvalid(() -> field.change("Origen", false, 0, List.of(
                new CustomFieldDefinition.OptionChange("alta", "Alta", false),
                new CustomFieldDefinition.OptionChange("alta", "Alta", false),
                new CustomFieldDefinition.OptionChange("media", "Media", false))));
        assertThat(field.getOptions()).hasSize(2);
    }

    @Test
    void anEditCannotHideEveryOptionOrGiveOptionsToAnotherType() {
        CustomFieldDefinition list = create("Origen", CustomFieldType.LIST, List.of("Alta"), Set.of());
        CustomFieldDefinition text = create("Notas", CustomFieldType.TEXT, List.of(), Set.of());

        assertInvalid(() -> list.change("Origen", false, 0, List.of(
                new CustomFieldDefinition.OptionChange("alta", "Alta", true))));
        assertInvalid(() -> text.change("Notas", false, 0, List.of(
                new CustomFieldDefinition.OptionChange(null, "Una", false))));
        assertInvalid(() -> text.change("Notas", false, -1, List.of()));
    }

    @Test
    void aRejectedEditShouldLeaveTheFieldUntouched() {
        CustomFieldDefinition field = create("Origen", CustomFieldType.LIST, List.of("Alta"), Set.of());

        assertInvalid(() -> field.change("Nuevo nombre", true, 5, List.of()));

        assertThat(field.getLabel()).isEqualTo("Origen");
        assertThat(field.isRequired()).isFalse();
        assertThat(field.getPosition()).isZero();
    }

    private static void assertInvalid(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(InvalidCustomFieldDefinitionException.class);
    }

    private static CustomFieldDefinition create(
            String label, CustomFieldType type, List<String> options, Set<String> takenKeys) {
        return CustomFieldDefinition.create(CustomFieldEntity.DEFENDANT, label, type, false, options, 0, takenKeys);
    }
}
