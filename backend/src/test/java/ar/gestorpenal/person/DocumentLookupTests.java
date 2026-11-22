package ar.gestorpenal.person;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** How document numbers are normalized and how a DNI is matched with a CUIT or CUIL. */
class DocumentLookupTests {

    @Test
    void shouldNormalizeToUppercaseWithoutSpacesDotsOrHyphens() {
        assertThat(DocumentLookup.normalize("30.123.456")).isEqualTo("30123456");
        assertThat(DocumentLookup.normalize("  ab-12 34 ")).isEqualTo("AB1234");
        assertThat(DocumentLookup.normalize("20-30123456-7")).isEqualTo("20301234567");
    }

    @Test
    void aDniShouldMatchTheCuilThatContainsIt() {
        DocumentLookup lookup = DocumentLookup.of("30.123.456");

        assertThat(lookup.numbers()).containsExactly("30123456");
        assertThat(lookup.embeddedDni()).isEqualTo("30123456");
    }

    @Test
    void aSevenDigitDniShouldBePaddedToEightDigits() {
        assertThat(DocumentLookup.of("1.234.567").embeddedDni()).isEqualTo("01234567");
    }

    @Test
    void aCuilShouldMatchTheDniInsideIt() {
        DocumentLookup lookup = DocumentLookup.of("20-30123456-7");

        assertThat(lookup.numbers()).containsExactly("20301234567", "30123456");
        assertThat(lookup.embeddedDni()).isEmpty();
    }

    @Test
    void aCuilWithALeadingZeroDniShouldAlsoMatchTheSevenDigitDni() {
        assertThat(DocumentLookup.of("20-01234567-3").numbers())
                .containsExactly("20012345673", "01234567", "1234567");
    }

    @Test
    void otherDocumentsShouldOnlyMatchThemselves() {
        DocumentLookup lookup = DocumentLookup.of("ab 123");

        assertThat(lookup.numbers()).containsExactly("AB123");
        assertThat(lookup.embeddedDni()).isEmpty();
    }

    @Test
    void documentTypesShouldAcceptTheirOwnShapeOnly() {
        assertThat(DocumentType.DNI.accepts("30123456")).isTrue();
        assertThat(DocumentType.DNI.accepts("ABC")).isFalse();
        assertThat(DocumentType.DNI.accepts("20301234567")).isFalse();
        assertThat(DocumentType.CUIL.accepts("20301234567")).isTrue();
        assertThat(DocumentType.CUIT.accepts("2030123456")).isFalse();
        assertThat(DocumentType.PASSPORT.accepts("AAB123456")).isTrue();
        assertThat(DocumentType.OTHER.accepts("")).isFalse();
    }
}
