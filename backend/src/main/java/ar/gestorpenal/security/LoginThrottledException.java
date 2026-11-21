package ar.gestorpenal.security;

import java.time.Duration;

/** Too many failed logins; mapped to 429 with a {@code Retry-After} header. */
class LoginThrottledException extends RuntimeException {

    private final Duration retryAfter;

    LoginThrottledException(Duration retryAfter) {
        super("Too many failed login attempts");
        this.retryAfter = retryAfter;
    }

    /** Whole seconds, rounded up and at least one, as {@code Retry-After} requires. */
    long retryAfterSeconds() {
        long seconds = retryAfter.toSeconds() + (retryAfter.toNanosPart() > 0 ? 1 : 0);
        return Math.max(1, seconds);
    }
}
