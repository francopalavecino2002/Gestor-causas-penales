package ar.gestorpenal.person;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.List;
import java.util.UUID;

/**
 * A person as the Personas screen shows them: the person's own fields (unwrapped, so the JSON keeps
 * the {@link PersonView} shape the pickers read), their client record if any and their roles in
 * cases, already masked for reserved cases the current user cannot see.
 */
record PersonListItem(@JsonUnwrapped PersonView person, UUID clientId, List<CaseRole> caseRoles) {}
