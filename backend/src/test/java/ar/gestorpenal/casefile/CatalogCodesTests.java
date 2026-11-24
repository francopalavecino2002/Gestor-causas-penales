package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

/** The catalog codes the case enums map to; the package loader requires the same lists of every area. */
class CatalogCodesTests {

    @Test
    void actionTypesShouldMapToTheirCatalogCodes() {
        assertThat(Arrays.stream(ActionType.values()).map(ActionType::catalogCode))
                .containsExactly("public", "public-on-complaint", "private");
    }

    @Test
    void representationsShouldMapToTheirCatalogCodes() {
        assertThat(Arrays.stream(Representation.values()).map(Representation::catalogCode))
                .containsExactly("defence", "private-prosecution");
    }
}
