package ar.gestorpenal.hearing;

import java.time.Instant;
import java.util.UUID;

/** The few facts other features (tasks) need about a hearing of the current firm. */
public record HearingRef(UUID id, UUID caseId, String typeCode, Instant startsAt, boolean archived) {}
