package ar.gestorpenal.deadline;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

/**
 * Deadlines count local days of the firm's province (ADR-0016, ADR-0017). Uses the injectable
 * {@link Clock}, so tests can fix the time.
 */
@Component
class DeadlineClock {

    /** Neuquén's zone in the tz database (UTC-3 all year), the same one the agenda uses. */
    static final ZoneId ZONE = ZoneId.of("America/Argentina/Salta");

    private final Clock clock;

    DeadlineClock(Clock clock) {
        this.clock = clock;
    }

    Instant now() {
        return clock.instant();
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }
}
