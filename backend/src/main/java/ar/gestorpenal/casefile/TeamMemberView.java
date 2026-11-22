package ar.gestorpenal.casefile;

import java.util.UUID;

/** An active member of a case's team. */
record TeamMemberView(UUID userId, String displayName, TeamRole role) {}
