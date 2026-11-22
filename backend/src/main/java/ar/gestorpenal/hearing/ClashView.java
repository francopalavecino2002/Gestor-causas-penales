package ar.gestorpenal.hearing;

import java.time.Instant;
import java.util.UUID;

/**
 * Another hearing that overlaps for one of the lawyers: a warning, never an error. For a reserved
 * case the user cannot see, {@code caseId} and {@code caseCaption} are hidden and {@code reserved} is
 * set, so the clash still shows without revealing the case.
 */
record ClashView(UUID hearingId, UUID userId, Instant startsAt, UUID caseId, String caseCaption, boolean reserved) {}
