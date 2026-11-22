package ar.gestorpenal.person;

import java.util.UUID;

/**
 * What a person is in a case, for the conflict check. When the case is reserved and the current user
 * cannot see it, {@code caseId} and {@code caption} are {@code null} and {@code reserved} is true: the
 * alert still fires without revealing the case.
 */
public record CaseRole(
        UUID caseId, String caption, String roleCode, String roleName, boolean caseArchived, boolean reserved) {}
