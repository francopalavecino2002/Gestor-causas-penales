package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.person.PersonKind;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DefendantTests {

    @Test
    void shouldTakeDefaultsWhenOmitted() {
        Defendant defendant = create(data(null, null, null, null, null, null, null));

        assertThat(defendant.getStageCode()).isEqualTo("averiguacion-preliminar");
        assertThat(defendant.getStatus()).isEqualTo(DefendantStatus.ACTIVE);
        assertThat(defendant.isDefendedByFirm()).isTrue();
        assertThat(defendant.getDefenceCounselKind()).isEqualTo(CounselKind.PRIVATE);
    }

    @Test
    void aClosedDefendantNeedsTheClosedStageAndAnOutcomeAndOnlyThen() {
        assertInvalid(data("investigacion-preparatoria", DefendantStatus.CLOSED, "archivo", null, null, null, null));
        assertInvalid(data("cerrada", DefendantStatus.CLOSED, null, null, null, null, null));
        assertInvalid(data("cerrada", DefendantStatus.ACTIVE, null, null, null, null, null));
        assertInvalid(data("juicio", DefendantStatus.ACTIVE, "archivo", null, null, null, null));
        assertThat(create(data("cerrada", DefendantStatus.CLOSED, "archivo", null, null, null, null)).isClosed()).isTrue();
    }

    @Test
    void aRebellionCannotBeLiftedBeforeItIsDeclared() {
        LocalDate declared = LocalDate.of(2026, 3, 10);

        assertInvalid(data(null, null, null, null, LocalDate.of(2026, 3, 11), null, null));
        assertInvalid(data(null, null, null, declared, declared.minusDays(1), null, null));
        assertThat(create(data(null, null, null, declared, declared, null, null)).getRebellionLiftedOn()).isEqualTo(declared);
    }

    @Test
    void belongingToAnIndigenousPeopleOnlyAppliesToHumans() {
        DefendantData data = data(null, null, null, null, null, true, null);

        assertThatThrownBy(() -> Defendant.create(UUID.randomUUID(), UUID.randomUUID(), data, PersonKind.LEGAL))
                .isInstanceOf(InvalidCaseDataException.class);
        assertThat(create(data).getIndigenousPeople()).isTrue();
    }

    @Test
    void aDefendantDefendedByTheFirmCannotHaveAPublicDefender() {
        assertInvalid(data(null, null, null, null, null, null, CounselKind.PUBLIC));
        Defendant other = create(new DefendantData(null, null, null, null, null, false, CounselKind.PUBLIC,
                "Defensor Ficticio", null, null, null));

        assertThat(other.isDefendedByFirm()).isFalse();
        assertThat(other.getDefenceCounselKind()).isEqualTo(CounselKind.PUBLIC);
        assertThat(other.getDefenceCounselName()).isEqualTo("Defensor Ficticio");
    }

    private static void assertInvalid(DefendantData data) {
        assertThatThrownBy(() -> create(data)).isInstanceOf(InvalidCaseDataException.class);
    }

    private static Defendant create(DefendantData data) {
        return Defendant.create(UUID.randomUUID(), UUID.randomUUID(), data, PersonKind.HUMAN);
    }

    private static DefendantData data(
            String stage, DefendantStatus status, String outcome, LocalDate declared, LocalDate lifted,
            Boolean indigenous, CounselKind counsel) {
        return new DefendantData(null, stage, status, outcome, null, null, counsel, null, declared, lifted, indigenous);
    }
}
