package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.person.CaseRole;
import ar.gestorpenal.person.PersonCaseRoles;
import ar.gestorpenal.security.AuthenticatedUser;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tells the conflict check what people are in which cases (ADR-0015). Defendants count as role
 * {@code imputado}. A reserved case the current user cannot see is reported without its id and
 * caption, so the alert still fires without revealing the case. Without a logged-in user nothing
 * reserved is revealed.
 */
@Component
class CaseRoleLookup implements PersonCaseRoles {

    private final CasePartyRepository parties;
    private final DefendantRepository defendants;
    private final CaseFileRepository cases;
    private final CaseAccess access;
    private final CaseCatalogs catalogs;

    CaseRoleLookup(
            CasePartyRepository parties,
            DefendantRepository defendants,
            CaseFileRepository cases,
            CaseAccess access,
            CaseCatalogs catalogs) {
        this.parties = parties;
        this.defendants = defendants;
        this.cases = cases;
        this.access = access;
        this.catalogs = catalogs;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, List<CaseRole>> rolesOf(Collection<UUID> personIds) {
        if (personIds.isEmpty()) {
            return Map.of();
        }
        List<CaseParty> partyRows = parties.findByPersonIdInAndArchivedAtIsNull(personIds);
        List<Defendant> defendantRows = defendants.findByPersonIdInAndArchivedAtIsNull(personIds);
        Map<UUID, CaseFile> casesById = cases
                .findAllById(caseIds(partyRows, defendantRows))
                .stream()
                .collect(Collectors.toMap(CaseFile::getId, Function.identity()));
        Map<String, Map<String, String>> roleNames = new HashMap<>();
        AuthenticatedUser user = currentUser();

        Map<UUID, List<CaseRole>> roles = new HashMap<>();
        defendantRows.forEach(row -> add(roles, row.getPersonId(), casesById.get(row.getCaseId()),
                CasePartyService.DEFENDANT_ROLE, roleNames, user));
        partyRows.forEach(row -> add(roles, row.getPersonId(), casesById.get(row.getCaseId()),
                row.getRoleCode(), roleNames, user));
        return roles;
    }

    private void add(
            Map<UUID, List<CaseRole>> roles,
            UUID personId,
            CaseFile caseFile,
            String roleCode,
            Map<String, Map<String, String>> roleNames,
            AuthenticatedUser user) {
        String roleName = roleNames
                .computeIfAbsent(caseFile.getPracticeArea(), area -> catalogs.names(area, Catalog.PARTY_ROLES))
                .getOrDefault(roleCode, roleCode);
        boolean visible = !caseFile.isReserved() || (user != null && access.canSee(user, caseFile));
        CaseRole role = visible
                ? new CaseRole(caseFile.getId(), caseFile.getCaption(), roleCode, roleName, caseFile.isArchived(), false)
                : new CaseRole(null, null, roleCode, roleName, false, true);
        roles.computeIfAbsent(personId, id -> new ArrayList<>()).add(role);
    }

    private static List<UUID> caseIds(List<CaseParty> partyRows, List<Defendant> defendantRows) {
        return Stream.concat(
                        partyRows.stream().map(CaseParty::getCaseId),
                        defendantRows.stream().map(Defendant::getCaseId))
                .distinct()
                .toList();
    }

    private static AuthenticatedUser currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user ? user : null;
    }
}
