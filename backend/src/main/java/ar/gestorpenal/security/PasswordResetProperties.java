package ar.gestorpenal.security;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Password recovery by email (ADR-0049).
 *
 * @param tokenTtl how long a link works after it is sent
 * @param maxRequestsPerAccount links that can be asked for one firm + email within {@code window}
 * @param maxRequestsPerClient requests one client address can make within {@code window}
 * @param window the sliding window of both request limits
 */
@ConfigurationProperties("app.security.password-reset")
record PasswordResetProperties(
        @DefaultValue("30m") Duration tokenTtl,
        @DefaultValue("3") int maxRequestsPerAccount,
        @DefaultValue("10") int maxRequestsPerClient,
        @DefaultValue("1h") Duration window) {

    /** The request limits in the shape of the login throttle, which counts them the same way. */
    LoginThrottleProperties requestLimits() {
        return new LoginThrottleProperties(maxRequestsPerAccount, maxRequestsPerClient, window);
    }
}
