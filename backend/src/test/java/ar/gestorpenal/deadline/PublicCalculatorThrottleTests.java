package ar.gestorpenal.deadline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class PublicCalculatorThrottleTests {

    private static final String CLIENT = "203.0.113.7";
    private static final String OTHER_CLIENT = "198.51.100.1";

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-20T12:00:00Z"));
    private final PublicCalculatorThrottle throttle =
            new PublicCalculatorThrottle(new PublicCalculatorProperties(3, Duration.ofMinutes(1)), clock);

    @Test
    void shouldAllowRequestsUpToTheLimit() {
        throttle.acquire(CLIENT);
        throttle.acquire(CLIENT);

        assertThatCode(() -> throttle.acquire(CLIENT)).doesNotThrowAnyException();
    }

    @Test
    void shouldBlockTheClientUntilTheOldestRequestLeavesTheWindow() {
        throttle.acquire(CLIENT);
        clock.advance(Duration.ofSeconds(20));
        throttle.acquire(CLIENT);
        throttle.acquire(CLIENT);

        assertThatThrownBy(() -> throttle.acquire(CLIENT))
                .isInstanceOfSatisfying(PublicCalculatorThrottledException.class,
                        e -> assertThat(e.retryAfterSeconds()).isEqualTo(40));
        assertThatCode(() -> throttle.acquire(OTHER_CLIENT)).doesNotThrowAnyException();

        clock.advance(Duration.ofSeconds(40));
        assertThatCode(() -> throttle.acquire(CLIENT)).doesNotThrowAnyException();
    }

    @Test
    void shouldNotCountRefusedRequests() {
        for (int i = 0; i < 3; i++) {
            throttle.acquire(CLIENT);
        }
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> throttle.acquire(CLIENT)).isInstanceOf(PublicCalculatorThrottledException.class);
        }

        clock.advance(Duration.ofMinutes(1));
        assertThatCode(() -> throttle.acquire(CLIENT)).doesNotThrowAnyException();
    }

    @Test
    void shouldBoundTheTrackedAddresses() {
        for (int i = 0; i < PublicCalculatorThrottle.MAX_TRACKED_CLIENTS + 100; i++) {
            throttle.acquire("client-" + i);
        }

        assertThat(throttle.trackedClients()).isEqualTo(PublicCalculatorThrottle.MAX_TRACKED_CLIENTS);
    }

    @Test
    void shouldRoundTheWaitUpToWholeSeconds() {
        assertThat(new PublicCalculatorThrottledException(Duration.ofMillis(1)).retryAfterSeconds()).isEqualTo(1);
        assertThat(new PublicCalculatorThrottledException(Duration.ofMillis(1500)).retryAfterSeconds()).isEqualTo(2);
        assertThat(new PublicCalculatorThrottledException(Duration.ZERO).retryAfterSeconds()).isEqualTo(1);
    }

    private static final class MutableClock extends Clock {

        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
