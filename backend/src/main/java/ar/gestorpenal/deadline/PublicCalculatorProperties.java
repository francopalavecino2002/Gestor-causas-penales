package ar.gestorpenal.deadline;

import jakarta.validation.constraints.Min;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/** Requests per client address within a sliding {@code window} to the public deadline calculator (ADR-0041). */
@ConfigurationProperties("app.public.deadline-calculator")
@Validated
record PublicCalculatorProperties(
        @DefaultValue("30") @Min(1) int maxRequestsPerClient,
        @DefaultValue("1m") Duration window) {}
