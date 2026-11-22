package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cases of the current firm and their teams (ADR-0015). The caller must be inside a tenant; every
 * case is loaded through {@link CaseAccess}, so a reserved case the user cannot see is "not found".
 */
@Service
class CaseService {

    static final int MAX_PAGE_SIZE = 100;

    private final CaseFileRepository cases;
    private final CaseTeamMemberRepository team;
    private final CaseAccess access;
    private final CaseCatalogs catalogs;
    private final CaseViews views;
    private final UserRepository users;

    CaseService(
            CaseFileRepository cases,
            CaseTeamMemberRepository team,
            CaseAccess access,
            CaseCatalogs catalogs,
            CaseViews views,
            UserRepository users) {
        this.cases = cases;
        this.team = team;
        this.access = access;
        this.catalogs = catalogs;
        this.views = views;
        this.users = users;
    }

    /**
     * Opens a case. The responsible (the creator by default) must be an owner or lawyer of the firm. A
     * reserved case is only seen by its team, so a creator who is not on it joins as a collaborator.
     */
    @Transactional
    CaseDetail create(AuthenticatedUser user, CaseData data) {
        UUID responsibleId = data.responsibleUserId() == null ? user.userId() : data.responsibleUserId();
        requireResponsible(findUser(responsibleId));
        requireNumbersFree(user, data, null);
        CaseFile caseFile = CaseFile.create(data);
        catalogs.requireOffered(Catalog.CIRCUMSCRIPTIONS, caseFile.getCircumscriptionCode(), null);
        cases.saveAndFlush(caseFile);
        team.save(CaseTeamMember.create(caseFile.getId(), responsibleId, TeamRole.RESPONSIBLE));
        if (caseFile.isReserved() && !CasePermissions.seesEveryCase(user) && !user.userId().equals(responsibleId)) {
            team.save(CaseTeamMember.create(caseFile.getId(), user.userId(), TeamRole.COLLABORATOR));
        }
        return views.detail(caseFile);
    }

    @Transactional(readOnly = true)
    CaseDetail get(AuthenticatedUser user, UUID id) {
        return views.detail(access.requireVisible(user, id));
    }

    /** Replaces the editable fields. Changing {@code reserved} is for the owner and the responsible. */
    @Transactional
    CaseDetail update(AuthenticatedUser user, UUID id, CaseData data) {
        CaseFile caseFile = access.requireVisible(user, id);
        if (data.isReservedCase() != caseFile.isReserved()) {
            CasePermissions.requireCanManageTeam(user, responsibleOf(id).orElse(null));
        }
        requireNumbersFree(user, data, id);
        String circumscription = Text.clean(data.circumscriptionCode());
        if (circumscription != null) {
            catalogs.requireOffered(Catalog.CIRCUMSCRIPTIONS, circumscription, caseFile.getCircumscriptionCode());
        }
        caseFile.apply(data);
        return views.detail(caseFile);
    }

    @Transactional(readOnly = true)
    CasePage search(AuthenticatedUser user, String query, boolean includeArchived, int page, int size) {
        String text = Text.clean(query) == null ? "" : stripWildcards(query);
        String legajo = text.isEmpty() ? "" : MpfLegajo.searchForm(text);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        Page<CaseFile> found = cases.search(
                "%" + text.toLowerCase(Locale.ROOT) + "%",
                "%" + legajo + "%",
                includeArchived,
                CasePermissions.seesEveryCase(user),
                user.userId(),
                pageRequest);
        return new CasePage(views.heads(found.getContent()), found.getNumber(), found.getSize(), found.getTotalElements());
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID id) {
        CaseFile caseFile = access.requireVisible(user, id);
        CasePermissions.requireCanArchive(user);
        caseFile.archive();
    }

    @Transactional
    void restore(AuthenticatedUser user, UUID id) {
        CaseFile caseFile = access.requireVisible(user, id);
        CasePermissions.requireCanArchive(user);
        caseFile.restore();
    }

    /**
     * Replaces the team. Members that stay are untouched; a removed member, or one whose role changed,
     * has the old row archived (a changed role then gets a new row). Archived rows are flushed before
     * the new ones are inserted, because the unique indexes only cover active rows.
     */
    @Transactional
    CaseDetail replaceTeam(AuthenticatedUser user, UUID id, TeamData data) {
        CaseFile caseFile = access.requireVisible(user, id);
        List<CaseTeamMember> current = team.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(id);
        UUID currentResponsible = current.stream()
                .filter(member -> member.getTeamRole() == TeamRole.RESPONSIBLE)
                .map(CaseTeamMember::getUserId)
                .findFirst()
                .orElse(null);
        CasePermissions.requireCanManageTeam(user, currentResponsible);
        requireValidTeam(data);

        List<TeamData.Member> toAdd = data.members().stream()
                .filter(member -> current.stream().noneMatch(row -> isSame(row, member)))
                .toList();
        current.stream()
                .filter(row -> data.members().stream().noneMatch(member -> isSame(row, member)))
                .forEach(CaseTeamMember::archive);
        team.flush();
        toAdd.forEach(member -> team.save(CaseTeamMember.create(id, member.userId(), member.role())));
        team.flush();
        return views.detail(caseFile);
    }

    private Optional<UUID> responsibleOf(UUID caseId) {
        return team.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseId).stream()
                .filter(member -> member.getTeamRole() == TeamRole.RESPONSIBLE)
                .map(CaseTeamMember::getUserId)
                .findFirst();
    }

    private void requireValidTeam(TeamData data) {
        long responsibles = data.members().stream().filter(member -> member.role() == TeamRole.RESPONSIBLE).count();
        if (responsibles != 1) {
            throw new InvalidCaseDataException("A case has exactly one responsible lawyer");
        }
        Set<UUID> seen = new HashSet<>();
        for (TeamData.Member member : data.members()) {
            if (!seen.add(member.userId())) {
                throw new InvalidCaseDataException("A user can appear only once in the team");
            }
            AppUser teamUser = findUser(member.userId());
            if (!teamUser.isActive()) {
                throw new InvalidCaseDataException("An archived user cannot join a team");
            }
            if (member.role() == TeamRole.RESPONSIBLE) {
                requireResponsible(teamUser);
            }
        }
    }

    private static boolean isSame(CaseTeamMember row, TeamData.Member member) {
        return row.getUserId().equals(member.userId()) && row.getTeamRole() == member.role();
    }

    private AppUser findUser(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new CaseRecordNotFoundException("There is no user " + userId));
    }

    private static void requireResponsible(AppUser candidate) {
        if (!candidate.isActive() || !CasePermissions.canBeResponsible(candidate.getRole())) {
            throw new InvalidCaseDataException("The responsible of a case must be an active owner or lawyer");
        }
    }

    /** A number in use by another case is a 409; the id is only given if the user can see that case. */
    private void requireNumbersFree(AuthenticatedUser user, CaseData data, UUID selfId) {
        String legajo = MpfLegajo.normalize(data.mpfLegajo());
        if (legajo != null) {
            cases.findByMpfLegajo(legajo)
                    .filter(existing -> !existing.getId().equals(selfId))
                    .ifPresent(existing -> {
                        throw duplicate(user, DuplicateCaseNumberException.Kind.MPF_LEGAJO, existing);
                    });
        }
        String internal = Text.clean(data.internalNumber());
        if (internal != null) {
            cases.findByInternalNumber(internal)
                    .filter(existing -> !existing.getId().equals(selfId))
                    .ifPresent(existing -> {
                        throw duplicate(user, DuplicateCaseNumberException.Kind.INTERNAL_NUMBER, existing);
                    });
        }
    }

    private DuplicateCaseNumberException duplicate(
            AuthenticatedUser user, DuplicateCaseNumberException.Kind kind, CaseFile existing) {
        return new DuplicateCaseNumberException(kind, access.canSee(user, existing) ? existing.getId() : null);
    }

    private static String stripWildcards(String query) {
        return query.strip().replaceAll("[%_\\\\]", "");
    }
}
