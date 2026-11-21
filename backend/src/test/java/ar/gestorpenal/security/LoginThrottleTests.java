package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;

/** An {@code acquire} without a later {@code recordSuccess} is a failed attempt. */
class LoginThrottleTests {

    private static final String ACCOUNT = "estudio-ficticio|ana@ejemplo.test";
    private static final String CLIENT = "203.0.113.7";
    private static final String OTHER_CLIENT = "198.51.100.1";

    private final MutableClock clock = new MutableClock(Instant.parse("2026-01-05T12:00:00Z"));
    private final LoginThrottle throttle =
            new LoginThrottle(new LoginThrottleProperties(3, 5, Duration.ofMinutes(15)), clock);

    @Test
    void shouldAllowAttemptsUpToTheAccountLimit() {
        throttle.acquire(ACCOUNT, CLIENT);
        throttle.acquire(ACCOUNT, CLIENT);

        assertThatCode(() -> throttle.acquire(ACCOUNT, CLIENT)).doesNotThrowAnyException();
    }

    @Test
    void shouldBlockTheAccountUntilTheOldestFailureLeavesTheWindow() {
        throttle.acquire(ACCOUNT, CLIENT);
        clock.advance(Duration.ofMinutes(5));
        throttle.acquire(ACCOUNT, CLIENT);
        throttle.acquire(ACCOUNT, CLIENT);

        assertThatThrownBy(() -> throttle.acquire(ACCOUNT, OTHER_CLIENT))
                .isInstanceOfSatisfying(LoginThrottledException.class,
                        e -> assertThat(e.retryAfterSeconds()).isEqualTo(Duration.ofMinutes(10).toSeconds()));

        clock.advance(Duration.ofMinutes(10));
        assertThatCode(() -> throttle.acquire(ACCOUNT, CLIENT)).doesNotThrowAnyException();
    }

    @Test
    void shouldBlockAClientThatSpraysManyAccounts() {
        for (int i = 0; i < 5; i++) {
            throttle.acquire("estudio-ficticio|user" + i + "@ejemplo.test", CLIENT);
        }

        assertThatThrownBy(() -> throttle.acquire("estudio-ficticio|otro@ejemplo.test", CLIENT))
                .isInstanceOf(LoginThrottledException.class);
        assertThatCode(() -> throttle.acquire("estudio-ficticio|otro@ejemplo.test", OTHER_CLIENT))
                .doesNotThrowAnyException();
    }

    @Test
    void shouldClearTheAccountAndRefundTheClientOnSuccess() {
        throttle.acquire(ACCOUNT, CLIENT);
        throttle.acquire(ACCOUNT, CLIENT);
        throttle.acquire(ACCOUNT, CLIENT);
        throttle.recordSuccess(ACCOUNT, CLIENT);

        // The account starts over; the client keeps its 2 failures (the success was refunded).
        throttle.acquire(ACCOUNT, CLIENT);
        throttle.acquire(ACCOUNT, CLIENT);
        throttle.acquire("estudio-ficticio|otro@ejemplo.test", CLIENT);
        assertThatThrownBy(() -> throttle.acquire("estudio-ficticio|nuevo@ejemplo.test", CLIENT))
                .isInstanceOf(LoginThrottledException.class);
    }

    @Test
    void shouldNotLetAParallelBurstExceedTheLimit() throws Exception {
        int threads = 20;
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                String client = "198.51.100." + i;
                results.add(executor.submit(() -> {
                    start.await();
                    try {
                        throttle.acquire(ACCOUNT, client);
                        return true;
                    } catch (LoginThrottledException e) {
                        return false;
                    }
                }));
            }
            start.countDown();

            long allowed = 0;
            for (Future<Boolean> result : results) {
                allowed += result.get() ? 1 : 0;
            }
            assertThat(allowed).isEqualTo(3);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void shouldBoundTheNumberOfTrackedKeys() {
        LoginThrottle generous =
                new LoginThrottle(new LoginThrottleProperties(3, Integer.MAX_VALUE, Duration.ofMinutes(15)), clock);

        for (int i = 0; i < LoginThrottle.MAX_TRACKED_KEYS + 100; i++) {
            generous.acquire("estudio-ficticio|user" + i + "@ejemplo.test", CLIENT);
        }

        assertThat(generous.trackedKeys()).isEqualTo(LoginThrottle.MAX_TRACKED_KEYS);
    }

    @Test
    void shouldRoundRetryAfterUpToAtLeastOneSecond() {
        assertThat(new LoginThrottledException(Duration.ofMillis(1)).retryAfterSeconds()).isEqualTo(1);
        assertThat(new LoginThrottledException(Duration.ofMillis(1500)).retryAfterSeconds()).isEqualTo(2);
        assertThat(new LoginThrottledException(Duration.ZERO).retryAfterSeconds()).isEqualTo(1);
    }

    private static final class MutableClock extends Clock {

        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            throw new UnsupportedOperationException();
        }
    }
}
