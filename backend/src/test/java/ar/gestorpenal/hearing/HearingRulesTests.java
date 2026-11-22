package ar.gestorpenal.hearing;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class HearingRulesTests {

    @Test
    void shouldAcceptACancellationReasonOnACancelledOrSuspendedHearing() {
        assertThatCode(() -> HearingRules.requireConsistent("cancelada", "fallas-tecnicas", null, null, false))
                .doesNotThrowAnyException();
        assertThatCode(() -> HearingRules.requireConsistent("suspendida", "pedido-del-fiscal", null, null, false))
                .doesNotThrowAnyException();
    }

    @Test
    void shouldRejectACancellationReasonOnAHearingThatIsNotCancelled() {
        assertThatThrownBy(() -> HearingRules.requireConsistent("programada", "fallas-tecnicas", null, null, false))
                .isInstanceOf(InvalidHearingDataException.class)
                .hasMessageContaining("cancellation reason");
        assertThatThrownBy(() -> HearingRules.requireConsistent("efectiva", "fallas-tecnicas", null, null, false))
                .isInstanceOf(InvalidHearingDataException.class);
    }

    @Test
    void aReconvertedHearingShouldNeedTheTypeItWasHeldAs() {
        assertThatThrownBy(() -> HearingRules.requireConsistent("reconvertida", null, null, null, false))
                .isInstanceOf(InvalidHearingDataException.class)
                .hasMessageContaining("held as");
        assertThatCode(() -> HearingRules.requireConsistent("reconvertida", null, "juicio-directo", null, false))
                .doesNotThrowAnyException();
    }

    @Test
    void shouldRejectTheHeldAsTypeOnAHearingThatWasNotReconverted() {
        assertThatThrownBy(() -> HearingRules.requireConsistent("efectiva", null, "juicio-directo", null, false))
                .isInstanceOf(InvalidHearingDataException.class)
                .hasMessageContaining("reconverted");
    }

    @Test
    void shouldAcceptAResultAndANextHearingOnlyWhenTheHearingTookPlace() {
        for (String status : new String[] {"efectiva", "cuarto-intermedio"}) {
            assertThatCode(() -> HearingRules.requireConsistent(status, null, null, "Se resolvió", true))
                    .doesNotThrowAnyException();
        }
        assertThatThrownBy(() -> HearingRules.requireConsistent("programada", null, null, "Se resolvió", false))
                .isInstanceOf(InvalidHearingDataException.class)
                .hasMessageContaining("result");
        assertThatThrownBy(() -> HearingRules.requireConsistent("cancelada", null, null, null, true))
                .isInstanceOf(InvalidHearingDataException.class);
    }

    @Test
    void theResultEndpointShouldOnlyRecordOutcomesOfAHearingThatTookPlace() {
        assertThatCode(() -> HearingRules.requireResultStatus("efectiva")).doesNotThrowAnyException();
        assertThatCode(() -> HearingRules.requireResultStatus("reconvertida")).doesNotThrowAnyException();
        assertThatCode(() -> HearingRules.requireResultStatus("cuarto-intermedio")).doesNotThrowAnyException();
        assertThatThrownBy(() -> HearingRules.requireResultStatus("cancelada"))
                .isInstanceOf(InvalidHearingDataException.class);
        assertThatThrownBy(() -> HearingRules.requireResultStatus("programada"))
                .isInstanceOf(InvalidHearingDataException.class);
    }

    @Test
    void reprogramadaShouldOnlyBeReachedByRescheduling() {
        assertThatThrownBy(() -> HearingRules.requireNotRescheduledByHand("reprogramada", "programada"))
                .isInstanceOf(InvalidHearingDataException.class)
                .hasMessageContaining("rescheduling");
        assertThatCode(() -> HearingRules.requireNotRescheduledByHand("reprogramada", "reprogramada"))
                .doesNotThrowAnyException();
        assertThatCode(() -> HearingRules.requireNotRescheduledByHand("programada", "reprogramada"))
                .doesNotThrowAnyException();
    }
}
