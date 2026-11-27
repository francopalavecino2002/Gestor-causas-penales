package ar.gestorpenal.signup;

import ar.gestorpenal.security.LoginThrottleProperties;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Firm self sign-up (ADR-0050). The lifetime of the verification link,
 * {@code app.signup.verification-ttl}, is read by {@code EmailVerificationService}.
 *
 * @param enabled whether the public "Probá gratis" page works; off unless {@code APP_SIGNUP_ENABLED=true}
 * @param trialLength how long the free trial of a new firm lasts
 * @param maxRequestsPerEmail sign-ups one email address can make within {@code window}
 * @param maxRequestsPerClient sign-ups one client address can make within {@code window}
 * @param window the sliding window of both limits
 */
@ConfigurationProperties("app.signup")
record SignupProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("30d") Duration trialLength,
        @DefaultValue("3") int maxRequestsPerEmail,
        @DefaultValue("5") int maxRequestsPerClient,
        @DefaultValue("1h") Duration window) {

    /** The limits in the shape of the login throttle, which counts them the same way. */
    LoginThrottleProperties requestLimits() {
        return new LoginThrottleProperties(maxRequestsPerEmail, maxRequestsPerClient, window);
    }
}
