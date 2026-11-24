package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** The spelling of a case's catalog codes on the wire: plain codes and the old enum-like names. */
class CatalogCodesTests {

    @Test
    void shouldReadBothSpellingsAsTheSameCode() {
        assertThat(CatalogCodes.fromWire("PUBLIC_ON_COMPLAINT")).isEqualTo("public-on-complaint");
        assertThat(CatalogCodes.fromWire("public-on-complaint")).isEqualTo("public-on-complaint");
        assertThat(CatalogCodes.fromWire(" DEFENCE ")).isEqualTo("defence");
        assertThat(CatalogCodes.fromWire(null)).isNull();
    }

    @Test
    void shouldWriteTheEnumLikeSpellingTheFrontendStillReads() {
        assertThat(CatalogCodes.toWire("public-on-complaint")).isEqualTo("PUBLIC_ON_COMPLAINT");
        assertThat(CatalogCodes.toWire("private-prosecution")).isEqualTo("PRIVATE_PROSECUTION");
        assertThat(CatalogCodes.toWire("sumarisimo")).isEqualTo("SUMARISIMO");
        assertThat(CatalogCodes.toWire(null)).isNull();
    }

    @Test
    void shouldRoundTripEveryCode() {
        for (String code : new String[] {"public", "public-on-complaint", "ordinario", "de-conciliacion-o-acuerdo"}) {
            assertThat(CatalogCodes.fromWire(CatalogCodes.toWire(code))).isEqualTo(code);
        }
    }
}
