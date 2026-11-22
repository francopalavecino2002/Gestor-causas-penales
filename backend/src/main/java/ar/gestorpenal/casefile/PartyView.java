package ar.gestorpenal.casefile;

import java.util.UUID;

/** A person with a role in a case. {@code personArchived} tells the person's record was archived. */
record PartyView(UUID id, UUID personId, String displayName, boolean personArchived, String roleCode, String roleName) {}
