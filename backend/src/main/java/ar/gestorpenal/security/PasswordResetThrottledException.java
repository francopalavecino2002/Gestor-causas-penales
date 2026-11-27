package ar.gestorpenal.security;

import java.time.Duration;

/** Too many recovery links asked for one account or from one client; 429 with {@code Retry-After}. */
class PasswordResetThrottledException extends LoginThrottledException {

    PasswordResetThrottledException(Duration retryAfter) {
        super(retryAfter);
    }
}
