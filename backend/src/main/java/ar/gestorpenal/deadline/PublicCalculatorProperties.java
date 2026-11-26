package ar.gestorpenal.deadline;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Requests per client address within a sliding {@code window} to the public deadline calculator (ADR-0041). */
@ConfigurationProperties("app.public.deadline-calculator")
record PublicCalculatorProperties(
        @DefaultValue("30") int maxRequestsPerClient,
        @DefaultValue("1m") Duration window) {}
