package ar.gestorpenal.customfield;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class CustomFieldSlugTests {

    @Test
    void shouldLowercaseStripAccentsAndJoinWordsWithHyphens() {
        assertThat(CustomFieldSlug.of("Fecha de detención", "campo")).isEqualTo("fecha-de-detencion");
        assertThat(CustomFieldSlug.of("  ¿Cuántos años?  ", "campo")).isEqualTo("cuantos-anos");
        assertThat(CustomFieldSlug.of("Ñandú", "campo")).isEqualTo("nandu");
        assertThat(CustomFieldSlug.of("N° de expediente (OFIJU)", "campo")).isEqualTo("n-de-expediente-ofiju");
    }

    @Test
    void shouldFallBackWhenTheLabelHasNoLettersOrDigits() {
        assertThat(CustomFieldSlug.of("???", "campo")).isEqualTo("campo");
        assertThat(CustomFieldSlug.of("   ", "opcion")).isEqualTo("opcion");
    }

    @Test
    void shouldCutLongLabelsWithoutALeadingOrTrailingHyphen() {
        assertThat(CustomFieldSlug.of("a".repeat(100), "campo")).isEqualTo("a".repeat(60));
        assertThat(CustomFieldSlug.of("a".repeat(59) + " b", "campo")).isEqualTo("a".repeat(59));
    }

    @Test
    void shouldAddANumberWhenTheSlugIsTaken() {
        assertThat(CustomFieldSlug.uniqueOf("Honorarios", "campo", Set.of())).isEqualTo("honorarios");
        assertThat(CustomFieldSlug.uniqueOf("Honorarios", "campo", Set.of("honorarios"))).isEqualTo("honorarios-2");
        assertThat(CustomFieldSlug.uniqueOf("Honorarios", "campo", Set.of("honorarios", "honorarios-2")))
                .isEqualTo("honorarios-3");
    }

    @Test
    void shouldKeepTheNumberedSlugWithinTheMaximumLength() {
        String longest = "a".repeat(60);

        String unique = CustomFieldSlug.uniqueOf(longest, "campo", Set.of(longest));

        assertThat(unique).hasSize(60).endsWith("-2");
    }
}
