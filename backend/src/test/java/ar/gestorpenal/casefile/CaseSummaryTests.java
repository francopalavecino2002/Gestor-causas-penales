package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;

import ar.gestorpenal.person.PersonKind;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CaseSummaryTests {

    private static final List<String> STAGES =
            List.of("averiguacion-preliminar", "investigacion-preparatoria", "etapa-intermedia", "juicio", "cerrada");

    @Test
    void aCaseWithoutDefendantsHasNoStage() {
        assertThat(CaseSummary.of(List.of(), STAGES)).isEqualTo(new CaseSummary(0, 0, null, 0, null));
    }

    @Test
    void shouldShowTheStageThatComesFirstInTheCatalogOrder() {
        List<Defendant> defendants = List.of(open("juicio"), open("investigacion-preparatoria"), open("etapa-intermedia"));

        assertThat(CaseSummary.of(defendants, STAGES)).isEqualTo(new CaseSummary(3, 3, "investigacion-preparatoria", 0, null));
    }

    @Test
    void aClosedDefendantShouldNotHoldTheCaseBack() {
        List<Defendant> defendants = List.of(closed(), open("juicio"));

        assertThat(CaseSummary.of(defendants, STAGES)).isEqualTo(new CaseSummary(2, 1, "juicio", 0, null));
    }

    @Test
    void shouldBeClosedWhenEveryDefendantIsClosed() {
        assertThat(CaseSummary.of(List.of(closed(), closed()), STAGES)).isEqualTo(new CaseSummary(2, 0, "cerrada", 0, null));
    }

    @Test
    void archivedDefendantsShouldBeIgnored() {
        Defendant archived = open("averiguacion-preliminar");
        archived.archive();

        assertThat(CaseSummary.of(List.of(archived, open("juicio")), STAGES))
                .isEqualTo(new CaseSummary(1, 1, "juicio", 0, null));
        assertThat(CaseSummary.of(List.of(archived), STAGES)).isEqualTo(new CaseSummary(0, 0, null, 0, null));
    }

    @Test
    void aSuspendedDefendantStillCountsAsOpen() {
        Defendant suspended = Defendant.create(UUID.randomUUID(), UUID.randomUUID(),
                new DefendantData(null, "juicio", DefendantStatus.SUSPENDED, null, null, null, null, null, null, null, null, null),
                PersonKind.HUMAN);

        assertThat(CaseSummary.of(List.of(suspended), STAGES)).isEqualTo(new CaseSummary(1, 1, "juicio", 0, null));
    }

    private static Defendant open(String stage) {
        return Defendant.create(UUID.randomUUID(), UUID.randomUUID(),
                new DefendantData(null, stage, null, null, null, null, null, null, null, null, null, null), PersonKind.HUMAN);
    }

    private static Defendant closed() {
        return Defendant.create(UUID.randomUUID(), UUID.randomUUID(),
                new DefendantData(null, "cerrada", DefendantStatus.CLOSED, "archivo", null, null, null, null, null, null, null, null),
                PersonKind.HUMAN);
    }
}
