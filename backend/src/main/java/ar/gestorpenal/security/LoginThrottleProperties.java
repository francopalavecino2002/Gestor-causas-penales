package ar.gestorpenal.security;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Failed-login limits within a sliding {@code window}: per account (firm + email) against password
 * guessing, and per client address against spraying many accounts.
 */
@ConfigurationProperties("app.security.login")
public record LoginThrottleProperties(
        @DefaultValue("5") int maxFailuresPerAccount,
        @DefaultValue("20") int maxFailuresPerClient,
        @DefaultValue("15m") Duration window) {}
