package ar.gestorpenal.hearing;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

/**
 * Days of the agenda are local days of the firm's province, not UTC days: a hearing at 23:30 belongs
 * to that day (ADR-0016). Uses the injectable {@link Clock}, so tests can fix the time.
 */
@Component
class HearingCalendar {

    /**
     * Neuquén's zone in the tz database: it has no zone of its own and shares
     * {@code America/Argentina/Salta} (UTC-3 all year) with most of Argentina.
     */
    static final ZoneId ZONE = ZoneId.of("America/Argentina/Salta");

    private final Clock clock;

    HearingCalendar(Clock clock) {
        this.clock = clock;
    }

    Instant now() {
        return clock.instant();
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    /** The first instant of {@code day} in the firm's zone. */
    Instant startOfDay(LocalDate day) {
        return day.atStartOfDay(ZONE).toInstant();
    }
}
