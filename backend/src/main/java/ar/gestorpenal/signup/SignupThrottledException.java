package ar.gestorpenal.signup;

/** Too many sign-ups for one email or from one client; 429 with {@code Retry-After}. */
class SignupThrottledException extends RuntimeException {

    private final long retryAfterSeconds;

    SignupThrottledException(long retryAfterSeconds) {
        super("Too many sign-up requests");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
