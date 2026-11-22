package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class MpfLegajoTests {

    @Test
    void shouldNormalizeCaseAndTheSpaceAfterTheSeat() {
        assertThat(MpfLegajo.normalize("MPFNQ 123989/2018")).isEqualTo("MPFNQ 123989/2018");
        assertThat(MpfLegajo.normalize("  mpfnq123989/2018 ")).isEqualTo("MPFNQ 123989/2018");
        assertThat(MpfLegajo.normalize("mpfza   22478/2017")).isEqualTo("MPFZA 22478/2017");
    }

    @Test
    void shouldTreatBlankAsNoLegajo() {
        assertThat(MpfLegajo.normalize(null)).isNull();
        assertThat(MpfLegajo.normalize("   ")).isNull();
    }

    @Test
    void shouldRejectWhatDoesNotLookLikeALegajo() {
        assertThatThrownBy(() -> MpfLegajo.normalize("123989/2018")).isInstanceOf(InvalidCaseDataException.class);
        assertThatThrownBy(() -> MpfLegajo.normalize("MPFNQ 123989-2018")).isInstanceOf(InvalidCaseDataException.class);
        assertThatThrownBy(() -> MpfLegajo.normalize("MPF 123989/2018")).isInstanceOf(InvalidCaseDataException.class);
        assertThatThrownBy(() -> MpfLegajo.normalize("MPFNQ 123989/18")).isInstanceOf(InvalidCaseDataException.class);
        assertThatThrownBy(() -> MpfLegajo.normalize("MPFNQ 12398912/2018")).isInstanceOf(InvalidCaseDataException.class);
    }

    @Test
    void searchFormShouldRestoreTheSpaceAndUppercase() {
        assertThat(MpfLegajo.searchForm("mpfnq123989")).isEqualTo("MPFNQ 123989");
        assertThat(MpfLegajo.searchForm("123989")).isEqualTo("123989");
    }
}
