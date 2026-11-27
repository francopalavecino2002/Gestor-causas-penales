package ar.gestorpenal.bootstrap;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The first firm and its owner (T66, ADR-0047). Under the {@code bootstrap} profile it is read from
 * {@code BOOTSTRAP_FIRM_NAME}, {@code BOOTSTRAP_FIRM_SLUG}, {@code BOOTSTRAP_OWNER_EMAIL} and
 * {@code BOOTSTRAP_OWNER_NAME} (see {@code application-bootstrap.properties}). No password: the
 * owner gets a temporary one that must be changed at the first login.
 */
@ConfigurationProperties(prefix = "app.bootstrap")
public record FirstFirmRequest(String firmName, String firmSlug, String ownerEmail, String ownerName) {}
