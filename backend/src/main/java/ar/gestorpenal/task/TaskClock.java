package ar.gestorpenal.task;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

/**
 * A task is due on a local day of the firm's province, like hearings and deadlines. Uses the
 * injectable {@link Clock}, so tests can fix the time.
 */
@Component
class TaskClock {

    /** Neuquén's zone in the tz database (UTC-3 all year), the same one the agenda uses. */
    static final ZoneId ZONE = ZoneId.of("America/Argentina/Salta");

    private final Clock clock;

    TaskClock(Clock clock) {
        this.clock = clock;
    }

    Instant now() {
        return clock.instant();
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }
}
