package ar.gestorpenal.aiassist;

import static org.assertj.core.api.Assertions.assertThat;

import ar.gestorpenal.aiassist.HearingNotificationReader.HearingTypeOption;
import ar.gestorpenal.aiassist.HearingNotificationReader.RawHearingDraft;
import java.util.List;
import org.junit.jupiter.api.Test;

class HearingDraftsTests {

    private static final List<HearingTypeOption> TYPES = List.of(
            new HearingTypeOption("formulacion-de-cargos", "Formulación de cargos"),
            new HearingTypeOption("control-de-acusacion", "Control de la acusación"));

    @Test
    void shouldKeepEveryValueThatFitsTheForm() {
        HearingDraft draft = HearingDrafts.checked(
                new RawHearingDraft("control-de-acusacion", "2035-03-14", "09:30", 90, " Sala 3 ",
                        "Jueza Ficticia Uno", "OFIJU-0000/2035"),
                TYPES);

        assertThat(draft).isEqualTo(new HearingDraft("control-de-acusacion", "2035-03-14", "09:30", 90, "Sala 3",
                "Jueza Ficticia Uno", "OFIJU-0000/2035", List.of()));
    }

    @Test
    void shouldDropATypeTheFirmDoesNotOffer() {
        HearingDraft draft = HearingDrafts.checked(
                new RawHearingDraft("audiencia-inventada", "2035-03-14", "09:30", null, null, null, null), TYPES);

        assertThat(draft.typeCode()).isNull();
        assertThat(draft.missing()).containsExactly("typeCode", "room", "judge", "ofijuReference");
    }

    @Test
    void shouldDropImpossibleDatesTimesAndDurations() {
        HearingDraft draft = HearingDrafts.checked(
                new RawHearingDraft("formulacion-de-cargos", "2035-02-30", "25:00", 2, "Sala 1", null, null), TYPES);

        assertThat(draft.date()).isNull();
        assertThat(draft.time()).isNull();
        assertThat(draft.durationMinutes()).isNull();
        assertThat(draft.missing()).contains("date", "time");
    }

    @Test
    void shouldNormaliseSecondsAwayAndDropTextsTooLongForTheirField() {
        HearingDraft draft = HearingDrafts.checked(
                new RawHearingDraft(null, " 2035-03-14 ", "09:30:00", null, "x".repeat(101), "  ", null), TYPES);

        assertThat(draft.date()).isEqualTo("2035-03-14");
        assertThat(draft.time()).isEqualTo("09:30");
        assertThat(draft.room()).isNull();
        assertThat(draft.judge()).isNull();
    }
}
