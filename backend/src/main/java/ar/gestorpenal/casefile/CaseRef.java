package ar.gestorpenal.casefile;

import java.util.UUID;

/**
 * The few facts other features (hearings) need about a case of the current firm.
 *
 * @param privateAction the criminal action is private (art. 101): there is no preventive detention
 * @param visible whether the user who asked may see the case; a reserved case they cannot see is
 *     still returned by {@link Cases#findAll}, so the caller can mask it instead of dropping it
 */
public record CaseRef(
        UUID id, String caption, boolean reserved, boolean archived, boolean privateAction, boolean visible) {}
