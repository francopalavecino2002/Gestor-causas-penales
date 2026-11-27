package ar.gestorpenal.signup;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class FirmSlugsTests {

    /** The {@code tenant_slug_format_ck} constraint. */
    private static final Pattern SLUG = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "Estudio Peña & Asociados|estudio-pena-asociados",
        "  Ñandú   Jurídico  |nandu-juridico",
        "Estudio 2024|estudio-2024",
        "---|estudio",
        "法律事务所|estudio"
    })
    void shouldTurnTheNameIntoAValidSlug(String name, String slug) {
        assertThat(FirmSlugs.fromName(name)).isEqualTo(slug).matches(SLUG);
    }

    @Test
    void shouldLeaveRoomForASuffixAndNeverEndInAHyphen() {
        String slug = FirmSlugs.fromName("Estudio " + "a".repeat(41) + " Asociados");

        assertThat(slug).hasSizeLessThanOrEqualTo(FirmSlugs.MAX_BASE_LENGTH).matches(SLUG);
    }
}
