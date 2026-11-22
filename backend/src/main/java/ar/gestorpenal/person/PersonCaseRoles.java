package ar.gestorpenal.person;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The roles people have in cases, implemented by the case feature. Declared here so the conflict
 * check can use it without {@code person} depending on {@code casefile}.
 */
public interface PersonCaseRoles {

    /** Active roles per person of the current firm, already masked for what the current user may see. */
    Map<UUID, List<CaseRole>> rolesOf(Collection<UUID> personIds);
}
