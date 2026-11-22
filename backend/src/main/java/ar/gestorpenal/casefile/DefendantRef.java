package ar.gestorpenal.casefile;

import java.util.UUID;

/** The few facts other features (hearings, coercive measures) need about a defendant. */
public record DefendantRef(UUID id, UUID caseId, UUID personId, String displayName, boolean archived) {}
