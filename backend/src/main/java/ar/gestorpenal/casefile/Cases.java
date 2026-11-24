package ar.gestorpenal.casefile;

import ar.gestorpenal.person.PersonSummary;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.security.AuthenticatedUser;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point to cases for other features (hearings), like {@code Persons} for
 * people. It only sees the current firm's rows (ADR-0007) and answers visibility questions with the
 * rules of {@link CaseAccess}; everything else in this package stays package-private.
 */
@Service
public class Cases {

    private final CaseFileRepository cases;
    private final CaseTeamMemberRepository team;
    private final DefendantRepository defendants;
    private final CaseAccess access;
    private final Persons persons;

    Cases(
            CaseFileRepository cases,
            CaseTeamMemberRepository team,
            DefendantRepository defendants,
            CaseAccess access,
            Persons persons) {
        this.cases = cases;
        this.team = team;
        this.defendants = defendants;
        this.access = access;
        this.persons = persons;
    }

    /** The case, archived or not, or empty when it does not exist or is a reserved case the user cannot see. */
    @Transactional(readOnly = true)
    public Optional<CaseRef> findVisible(AuthenticatedUser user, UUID caseId) {
        return cases.findById(caseId).filter(caseFile -> access.canSee(user, caseFile)).map(caseFile -> ref(user, caseFile));
    }

    /**
     * The case with this MPF legajo (any case or spacing), or with this internal number when no
     * legajo is given; empty when there is none or it is a reserved case the user cannot see. A
     * legajo that does not have the legajo format cannot belong to any case.
     */
    @Transactional(readOnly = true)
    public Optional<CaseRef> findVisibleByNumber(AuthenticatedUser user, String mpfLegajo, String internalNumber) {
        Optional<CaseFile> found;
        try {
            String legajo = MpfLegajo.normalize(mpfLegajo);
            String internal = Text.clean(internalNumber);
            found = legajo != null
                    ? cases.findByMpfLegajo(legajo)
                    : internal == null ? Optional.empty() : cases.findByInternalNumber(internal);
        } catch (InvalidCaseDataException e) {
            return Optional.empty();
        }
        return found.filter(caseFile -> access.canSee(user, caseFile)).map(caseFile -> ref(user, caseFile));
    }

    /** The defendants of the case that are not archived. */
    @Transactional(readOnly = true)
    public List<DefendantRef> activeDefendantsOf(UUID caseId) {
        List<UUID> ids = defendants.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseId).stream()
                .map(Defendant::getId)
                .toList();
        return List.copyOf(findDefendants(ids).values());
    }

    /** Every case that exists in the firm, each flagged with whether {@code user} may see it. */
    @Transactional(readOnly = true)
    public Map<UUID, CaseRef> findAll(AuthenticatedUser user, Collection<UUID> caseIds) {
        if (caseIds.isEmpty()) {
            return Map.of();
        }
        return cases.findAllById(caseIds).stream()
                .map(caseFile -> ref(user, caseFile))
                .collect(Collectors.toMap(CaseRef::id, Function.identity()));
    }

    /** The user of the active RESPONSIBLE of the case, if any. */
    @Transactional(readOnly = true)
    public Optional<UUID> responsibleOf(UUID caseId) {
        return team.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseId).stream()
                .filter(member -> member.getTeamRole() == TeamRole.RESPONSIBLE)
                .map(CaseTeamMember::getUserId)
                .findFirst();
    }

    /** The defendants (archived ones too) that exist in the firm, by id. */
    @Transactional(readOnly = true)
    public Map<UUID, DefendantRef> findDefendants(Collection<UUID> defendantIds) {
        if (defendantIds.isEmpty()) {
            return Map.of();
        }
        List<Defendant> rows = defendants.findAllById(defendantIds);
        Map<UUID, PersonSummary> people =
                persons.findAll(rows.stream().map(Defendant::getPersonId).distinct().toList());
        return rows.stream()
                .collect(Collectors.toMap(
                        Defendant::getId,
                        defendant -> new DefendantRef(
                                defendant.getId(),
                                defendant.getCaseId(),
                                defendant.getPersonId(),
                                people.get(defendant.getPersonId()).displayName(),
                                defendant.isArchived(),
                                defendant.getRebellionDeclaredOn(),
                                defendant.getRebellionLiftedOn())));
    }

    /** The owner sees every case, reserved ones included. */
    public boolean seesEveryCase(AuthenticatedUser user) {
        return CasePermissions.seesEveryCase(user);
    }

    /** Only the owner and lawyers archive or restore records (same rule as cases). */
    public void requireCanArchive(AuthenticatedUser user) {
        CasePermissions.requireCanArchive(user);
    }

    private CaseRef ref(AuthenticatedUser user, CaseFile caseFile) {
        return new CaseRef(
                caseFile.getId(),
                caseFile.getCaption(),
                caseFile.getPracticeArea(),
                caseFile.isReserved(),
                caseFile.isArchived(),
                caseFile.getActionType() == ActionType.PRIVATE,
                access.canSee(user, caseFile));
    }
}
