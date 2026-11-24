package ar.gestorpenal.hearing;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class IcsWriterTests {

    private static final Instant STAMP = Instant.parse("2035-05-01T12:00:00Z");

    @Test
    void shouldEscapeTheSpecialCharactersOfATextValue() {
        assertThat(IcsWriter.escape("a\\b;c,d\ne\r\nf")).isEqualTo("a\\\\b\\;c\\,d\\ne\\nf");
    }

    @Test
    void shouldLeaveAShortLineAlone() {
        assertThat(IcsWriter.fold("SUMMARY:corta")).isEqualTo("SUMMARY:corta");
    }

    @Test
    void shouldFoldALongLineAt75OctetsWithALeadingSpace() {
        String line = "DESCRIPTION:" + "x".repeat(200);

        String folded = IcsWriter.fold(line);

        String[] parts = folded.split("\r\n");
        assertThat(parts).hasSize(3);
        assertThat(parts[0]).hasSize(75);
        assertThat(parts[1]).startsWith(" ").hasSize(75);
        assertThat(folded.replace("\r\n ", "")).isEqualTo(line);
    }

    @Test
    void shouldNeverSplitAMultiByteCharacter() {
        String line = "SUMMARY:" + "ñ".repeat(100);

        String folded = IcsWriter.fold(line);

        assertThat(Arrays.stream(folded.split("\r\n")))
                .allSatisfy(part -> assertThat(part.getBytes(StandardCharsets.UTF_8).length).isLessThanOrEqualTo(75));
        assertThat(folded.replace("\r\n ", "")).isEqualTo(line);
    }

    @Test
    void shouldWriteACalendarWithItsEventsInUtcAndCrlfLineEndings() {
        UUID id = UUID.fromString("00000000-0000-0000-0000-000000000001");
        IcsWriter.Event event = new IcsWriter.Event(
                id,
                Instant.parse("2035-05-10T13:00:00Z"),
                Instant.parse("2035-05-10T14:00:00Z"),
                "Control de detención · Caso ficticio",
                "Sala 2",
                null,
                IcsWriter.Status.CANCELLED);

        String calendar = IcsWriter.calendar("Audiencias", "America/Argentina/Salta", STAMP, List.of(event));

        assertThat(calendar.replace("\r\n", "")).doesNotContain("\n");
        assertThat(calendar.split("\r\n")).containsSubsequence(
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:" + IcsWriter.PRODUCT_ID,
                "X-WR-CALNAME:Audiencias",
                "BEGIN:VEVENT",
                "UID:" + id + "@gestor-causas",
                "DTSTAMP:20350501T120000Z",
                "DTSTART:20350510T130000Z",
                "DTEND:20350510T140000Z",
                "SUMMARY:Control de detención · Caso ficticio",
                "LOCATION:Sala 2",
                "STATUS:CANCELLED",
                "END:VEVENT",
                "END:VCALENDAR");
        assertThat(calendar).doesNotContain("DESCRIPTION");
    }

    @Test
    void anEmptyCalendarShouldStillBeValid() {
        String calendar = IcsWriter.calendar("Audiencias", "America/Argentina/Salta", STAMP, List.of());

        assertThat(calendar).startsWith("BEGIN:VCALENDAR\r\n").endsWith("END:VCALENDAR\r\n").doesNotContain("VEVENT");
    }
}
