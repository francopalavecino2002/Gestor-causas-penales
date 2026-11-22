package ar.gestorpenal.hearing;

import static org.assertj.core.api.Assertions.assertThat;

import ar.gestorpenal.hearing.ClashDetector.Booking;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ClashDetectorTests {

    private static final UUID LAWYER = UUID.randomUUID();
    private static final Instant NINE = Instant.parse("2026-12-01T12:00:00Z");

    @Test
    void overlappingHearingsOfTheSameLawyerShouldClash() {
        Booking first = booking(LAWYER, NINE, 60);
        Booking second = booking(LAWYER, NINE.plusSeconds(30 * 60), 60);

        assertThat(first.clashesWith(second)).isTrue();
        assertThat(second.clashesWith(first)).isTrue();
    }

    @Test
    void aHearingContainedInAnotherShouldClash() {
        assertThat(booking(LAWYER, NINE, 180).clashesWith(booking(LAWYER, NINE.plusSeconds(3600), 30))).isTrue();
    }

    @Test
    void adjacentHearingsShouldNotClash() {
        Booking first = booking(LAWYER, NINE, 60);
        Booking second = booking(LAWYER, NINE.plusSeconds(3600), 60);

        assertThat(first.clashesWith(second)).isFalse();
        assertThat(second.clashesWith(first)).isFalse();
    }

    @Test
    void hearingsOfDifferentLawyersShouldNotClash() {
        assertThat(booking(LAWYER, NINE, 60).clashesWith(booking(UUID.randomUUID(), NINE, 60))).isFalse();
    }

    @Test
    void aHearingShouldNotClashWithItself() {
        Booking booking = booking(LAWYER, NINE, 60);

        assertThat(booking.clashesWith(booking)).isFalse();
    }

    @Test
    void shouldListOnlyTheBookingsThatClash() {
        Booking subject = booking(LAWYER, NINE, 60);
        Booking clashing = booking(LAWYER, NINE.plusSeconds(600), 20);
        Booking adjacent = booking(LAWYER, NINE.plusSeconds(3600), 60);
        Booking otherLawyer = booking(UUID.randomUUID(), NINE, 60);

        assertThat(ClashDetector.clashesOf(subject, List.of(clashing, adjacent, otherLawyer, subject)))
                .containsExactly(clashing);
    }

    @Test
    void cancelledAndSuspendedHearingsShouldNeverClash() {
        assertThat(ClashDetector.canClash("cancelada")).isFalse();
        assertThat(ClashDetector.canClash("suspendida")).isFalse();
        assertThat(ClashDetector.canClash("programada")).isTrue();
        assertThat(ClashDetector.canClash("reprogramada")).isTrue();
        assertThat(ClashDetector.canClash("efectiva")).isTrue();
    }

    private static Booking booking(UUID lawyer, Instant startsAt, int minutes) {
        return new Booking(UUID.randomUUID(), lawyer, startsAt, minutes);
    }
}
