package ar.gestorpenal.deadline;

import static org.assertj.core.api.Assertions.assertThat;

import ar.gestorpenal.deadline.DeadlineCalculator.Result;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class DeadlineStatusTests {

    private static final Instant NOW = Instant.parse("2026-05-10T15:00:00Z");

    private static Result dueIn(Duration duration) {
        Instant dueAt = NOW.plus(duration);
        return Result.due(dueAt.atZone(DeadlineClock.ZONE).toLocalDate(), dueAt, 0);
    }

    @Test
    void shouldBeMetOnceTheActIsDoneEvenIfTheTermEnded() {
        assertThat(DeadlineStatus.of(dueIn(Duration.ofDays(-3)), LocalDate.of(2026, 5, 1), NOW, 2))
                .isEqualTo(DeadlineStatus.MET);
    }

    @Test
    void shouldBeOverdueFromTheInstantTheTermEnds() {
        assertThat(DeadlineStatus.of(dueIn(Duration.ZERO), null, NOW, 2)).isEqualTo(DeadlineStatus.OVERDUE);
        assertThat(DeadlineStatus.of(dueIn(Duration.ofSeconds(1)), null, NOW, 2)).isEqualTo(DeadlineStatus.DUE_SOON);
    }

    @Test
    void shouldAlwaysBeDueSoonInTheLast24HoursEvenWithoutAWarning() {
        assertThat(DeadlineStatus.of(dueIn(Duration.ofHours(23)), null, NOW, 0)).isEqualTo(DeadlineStatus.DUE_SOON);
        assertThat(DeadlineStatus.of(dueIn(Duration.ofHours(25)), null, NOW, 0)).isEqualTo(DeadlineStatus.RUNNING);
    }

    @Test
    void shouldHonourTheFirmsWarning() {
        assertThat(DeadlineStatus.of(dueIn(Duration.ofDays(5)), null, NOW, 5)).isEqualTo(DeadlineStatus.DUE_SOON);
        assertThat(DeadlineStatus.of(dueIn(Duration.ofDays(6)), null, NOW, 5)).isEqualTo(DeadlineStatus.RUNNING);
    }

    @Test
    void shouldReportWhenThereIsNoDueDate() {
        assertThat(DeadlineStatus.of(Result.suspended(4), null, NOW, 2)).isEqualTo(DeadlineStatus.SUSPENDED);
        assertThat(DeadlineStatus.of(Result.calendarNotLoaded(2031), null, NOW, 2))
                .isEqualTo(DeadlineStatus.NOT_CALCULABLE);
    }
}
