package ar.gestorpenal.hearing;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** What a hearing becomes in a calendar app (ADR-0034). */
class HearingIcsEventTests {

    @Test
    void shouldEndAfterTheHearingsDuration() {
        IcsWriter.Event event = HearingIcsExport.event(hearing(HearingRules.SCHEDULED, false), false);

        assertThat(event.startsAt()).isEqualTo(Instant.parse("2035-05-10T13:00:00Z"));
        assertThat(event.endsAt()).isEqualTo(Instant.parse("2035-05-10T13:45:00Z"));
        assertThat(event.summary()).isEqualTo("Formulación de cargos · Caso ficticio");
        assertThat(event.description())
                .contains("Formulación de cargos (art. 168)")
                .contains("Juez/a: Juez Ficticio")
                .contains("Referencia OFIJU: OFJ-1-FICT")
                .contains("verificá los datos");
    }

    @Test
    void aReservedCaseShouldHideItsCaptionJudgeAndOfijuReference() {
        IcsWriter.Event event = HearingIcsExport.event(hearing(HearingRules.SCHEDULED, false), true);

        assertThat(event.summary()).isEqualTo("Formulación de cargos · " + HearingIcsExport.RESERVED_CAPTION);
        assertThat(event.description()).doesNotContain("Juez Ficticio").doesNotContain("OFJ-1-FICT");
        assertThat(event.location()).isEqualTo("Sala 3");
    }

    @Test
    void shouldMapTheStatusToTheCalendarsStatus() {
        assertThat(statusOf(HearingRules.REQUESTED, false)).isEqualTo(IcsWriter.Status.TENTATIVE);
        assertThat(statusOf(HearingRules.SCHEDULED, false)).isEqualTo(IcsWriter.Status.CONFIRMED);
        assertThat(statusOf(HearingRules.RESCHEDULED, false)).isEqualTo(IcsWriter.Status.CONFIRMED);
        assertThat(statusOf(HearingRules.CANCELLED, false)).isEqualTo(IcsWriter.Status.CANCELLED);
        assertThat(statusOf(HearingRules.SUSPENDED, false)).isEqualTo(IcsWriter.Status.CANCELLED);
        assertThat(statusOf(HearingRules.SCHEDULED, true)).isEqualTo(IcsWriter.Status.CANCELLED);
    }

    private static IcsWriter.Status statusOf(String statusCode, boolean archived) {
        return HearingIcsExport.event(hearing(statusCode, archived), false).status();
    }

    private static HearingView hearing(String statusCode, boolean archived) {
        return new HearingView(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Caso ficticio",
                "formulacion-de-cargos",
                "Formulación de cargos",
                "art. 168",
                Instant.parse("2035-05-10T13:00:00Z"),
                45,
                "Sala 3",
                "Juez Ficticio",
                "OFJ-1-FICT",
                null,
                statusCode,
                "Estado ficticio",
                null,
                null,
                null,
                null,
                null,
                null,
                "Nota interna ficticia",
                archived,
                Instant.parse("2035-05-01T12:00:00Z"),
                List.of(new NamedRef(UUID.randomUUID(), "Quiroga Ejemplo, Ana")),
                List.of());
    }
}
