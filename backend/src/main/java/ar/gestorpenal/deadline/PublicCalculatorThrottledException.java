package ar.gestorpenal.deadline;

import java.time.Duration;

/** A client asked the public calculator too often; it may try again after {@link #retryAfterSeconds()}. */
class PublicCalculatorThrottledException extends RuntimeException {

    private final Duration retryAfter;

    PublicCalculatorThrottledException(Duration retryAfter) {
        super("Too many calculations from this address");
        this.retryAfter = retryAfter;
    }

    /** At least one second, rounded up, for the {@code Retry-After} header. */
    long retryAfterSeconds() {
        long seconds = retryAfter.toSeconds() + (retryAfter.toNanosPart() > 0 ? 1 : 0);
        return Math.max(1, seconds);
    }
}
