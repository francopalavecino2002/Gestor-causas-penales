package ar.gestorpenal.casefile;

import ar.gestorpenal.customfield.CustomFieldEntity;
import ar.gestorpenal.customfield.CustomFields;
import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.PracticeAreas;
import ar.gestorpenal.jurisdiction.PracticeModule;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private final CustomFields customFields;
    private final PracticeAreas areas;

    CaseService(
            CaseFileRepository cases,
            CaseTeamMemberRepository team,
            CaseAccess access,
            CaseCatalogs catalogs,
            CaseViews views,
            UserRepository users,
            CustomFields customFields,
            PracticeAreas areas) {
        this.cases = cases;
        this.team = team;
        this.access = access;
        this.catalogs = catalogs;
        this.views = views;
        this.users = users;
        this.customFields = customFields;
        this.areas = areas;
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
        Map<String, Object> values = customFields.resolveNew(CustomFieldEntity.CASE_FILE, data.customFields());
        CaseFile caseFile = CaseFile.create(data);
        caseFile.replaceCustomFields(values);
        String area = caseFile.getPracticeArea();
        areas.requireEnabledForNewCase(area);
        requireCatalogCodes(area, data, null);
        caseFile.applyCourse(courseOf(area, data, null));
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
        CaseFile caseFile = access.requireEditable(user, id);
        if (data.reservedOr(caseFile.isReserved()) != caseFile.isReserved()) {
            CasePermissions.requireCanManageTeam(user, responsibleOf(id).orElse(null));
        }
        requireNumbersFree(user, data, id);
        requireCatalogCodes(caseFile.getPracticeArea(), data, caseFile);
        CaseCourse course = courseOf(caseFile.getPracticeArea(), data, caseFile);
        Map<String, Object> values =
                customFields.resolve(CustomFieldEntity.CASE_FILE, data.customFields(), caseFile.getCustomFields());
        caseFile.apply(data);
        caseFile.applyCourse(course);
        caseFile.replaceCustomFields(values);
        return views.detail(caseFile);
    }

    /**
     * The case's own stage, status and outcome, checked against its area's catalogs; {@code null} for an
     * area with the {@code defendants} module, where each defendant has them and the case must not.
     * {@code current} is the stored case, or {@code null} for a new one.
     */
    private CaseCourse courseOf(String area, CaseData data, CaseFile current) {
        if (areas.hasModule(area, PracticeModule.DEFENDANTS)) {
            if (data.stageCode() != null || data.status() != null || data.closingOutcomeCode() != null) {
                throw new InvalidCaseDataException(
                        "In this practice area the stage, status and closing outcome belong to each defendant");
            }
            return null;
        }
        CaseCourse course = current == null
                ? CaseCourse.initial(data, catalogs.firstOfferedStage(area))
                : CaseCourse.replacing(data);
        catalogs.requireOffered(area, Catalog.STAGES, course.stageCode(), current == null ? null : current.getStageCode());
        if (course.closingOutcomeCode() != null) {
            catalogs.requireOffered(area, Catalog.CLOSING_OUTCOMES, course.closingOutcomeCode(),
                    current == null ? null : current.getClosingOutcomeCode());
        }
        return course;
    }

    /**
     * Checks the case's catalog codes against its area's catalogs, and that the area has the module
     * of the optional fields the data fills in. {@code current} is the stored case, or {@code null}.
     */
    private void requireCatalogCodes(String area, CaseData data, CaseFile current) {
        String circumscription = Text.clean(data.circumscriptionCode());
        if (circumscription != null) {
            catalogs.requireOffered(
                    area, Catalog.CIRCUMSCRIPTIONS, circumscription, current == null ? null : current.getCircumscriptionCode());
        }
        catalogs.requireOffered(area, Catalog.ACTION_TYPES, data.actionType(),
                current == null ? null : current.getActionType());
        catalogs.requireOffered(area, Catalog.REPRESENTED_SIDES, data.represents(),
                current == null ? null : current.getRepresents());
        if (Text.clean(data.mpfLegajo()) != null) {
            areas.requireModule(area, PracticeModule.MPF_LEGAJO);
        }
    }

    @Transactional(readOnly = true)
    CasePage search(AuthenticatedUser user, String query, boolean includeArchived, String area, int page, int size) {
        String text = Text.clean(query) == null ? "" : stripWildcards(query);
        String legajo = text.isEmpty() ? "" : MpfLegajo.searchForm(text);
        String areaCode = Text.clean(area);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
        Page<CaseFile> found = cases.search(
                "%" + text.toLowerCase(Locale.ROOT) + "%",
                "%" + legajo + "%",
                includeArchived,
                areaCode == null ? "" : areaCode,
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
        CaseFile caseFile = access.requireEditable(user, id);
        List<CaseTeamMember> current = team.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(id);
        CasePermissions.requireCanManageTeam(user, responsibleIn(current).orElse(null));
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
        return responsibleIn(team.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseId));
    }

    private static Optional<UUID> responsibleIn(List<CaseTeamMember> members) {
        return members.stream()
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
