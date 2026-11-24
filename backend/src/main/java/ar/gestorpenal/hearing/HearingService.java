package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.casefile.DefendantRef;
import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hearings of the current firm (ADR-0016). Every hearing is reached through its case, so a case of
 * another firm, or a reserved case the user cannot see, is "not found". Catalog codes are checked
 * before the entity is changed: a query would otherwise flush a half-changed entity.
 */
@Service
class HearingService {

    private final HearingRepository hearings;
    private final HearingDefendantRepository hearingDefendants;
    private final HearingLawyerRepository hearingLawyers;
    private final HearingRescheduleRepository reschedules;
    private final HearingCatalogs catalogs;
    private final HearingViews views;
    private final HearingClashes clashes;
    private final Cases cases;
    private final UserRepository users;

    HearingService(
            HearingRepository hearings,
            HearingDefendantRepository hearingDefendants,
            HearingLawyerRepository hearingLawyers,
            HearingRescheduleRepository reschedules,
            HearingCatalogs catalogs,
            HearingViews views,
            HearingClashes clashes,
            Cases cases,
            UserRepository users) {
        this.hearings = hearings;
        this.hearingDefendants = hearingDefendants;
        this.hearingLawyers = hearingLawyers;
        this.reschedules = reschedules;
        this.catalogs = catalogs;
        this.views = views;
        this.clashes = clashes;
        this.cases = cases;
        this.users = users;
    }

    /** Creates a hearing. Without lawyers it is for the case's responsible; without defendants it has none. */
    @Transactional
    HearingDetail create(AuthenticatedUser user, UUID caseId, HearingData data) {
        CaseRef caseRef = requireVisibleCase(user, caseId);
        requireNotArchived(caseRef);
        requireCatalogCodes(caseRef.practiceArea(), data, null);
        List<UUID> defendantIds = checkedDefendants(caseId, data.defendantIds(), Set.of());
        List<UUID> lawyerIds =
                data.lawyerIds() == null ? defaultLawyers(caseId) : checkedLawyers(data.lawyerIds(), Set.of());
        Hearing hearing = hearings.saveAndFlush(Hearing.create(caseId, data));
        addDefendants(hearing.getId(), defendantIds);
        addLawyers(hearing.getId(), lawyerIds);
        hearings.flush();
        return detail(user, hearing);
    }

    @Transactional(readOnly = true)
    HearingDetail get(AuthenticatedUser user, UUID id) {
        return detail(user, find(user, id).hearing());
    }

    @Transactional(readOnly = true)
    List<HearingView> listByCase(AuthenticatedUser user, UUID caseId, boolean includeArchived) {
        requireVisibleCase(user, caseId);
        List<Hearing> found = includeArchived
                ? hearings.findByCaseIdOrderByStartsAtDescIdAsc(caseId)
                : hearings.findByCaseIdAndArchivedAtIsNullOrderByStartsAtDescIdAsc(caseId);
        return views.heads(user, found);
    }

    /** Replaces the editable fields; the date only changes by {@link #reschedule}. */
    @Transactional
    HearingDetail update(AuthenticatedUser user, UUID id, HearingData data) {
        Located located = findEditableLocated(user, id);
        Hearing hearing = located.hearing();
        requireCatalogCodes(located.caseRef().practiceArea(), data, hearing);
        // Defendants and lawyers already attached are kept even if archived since: only new ones are checked.
        List<UUID> defendantIds = data.defendantIds() == null
                ? null
                : checkedDefendants(hearing.getCaseId(), data.defendantIds(), Set.copyOf(activeDefendantIds(id)));
        List<UUID> lawyerIds = data.lawyerIds() == null
                ? null
                : checkedLawyers(data.lawyerIds(), Set.copyOf(activeLawyerIds(id)));
        hearing.apply(data);
        if (defendantIds != null) {
            replaceDefendants(id, defendantIds);
        }
        if (lawyerIds != null) {
            replaceLawyers(id, lawyerIds);
        }
        hearings.flush();
        return detail(user, hearing);
    }

    /** Moves the hearing to another date, keeping the history. A cancelled hearing cannot be rescheduled. */
    @Transactional
    HearingDetail reschedule(AuthenticatedUser user, UUID id, RescheduleData data) {
        Hearing hearing = findEditable(user, id);
        if (HearingRules.isFinallyCancelled(hearing.getStatusCode())) {
            throw new HearingStateException("A cancelled hearing cannot be rescheduled");
        }
        if (HearingRules.WITH_RESULT.contains(hearing.getStatusCode())) {
            throw new HearingStateException("A hearing that already has a result cannot be rescheduled");
        }
        Instant previous = hearing.getStartsAt();
        hearing.reschedule(data.startsAt());
        reschedules.save(HearingReschedule.create(id, previous, hearing.getStartsAt(), data.reason(), user.userId()));
        hearings.flush();
        return detail(user, hearing);
    }

    /**
     * Records how the hearing ended. A next hearing is created in the same case, with the same
     * defendants and lawyers, and linked to this one.
     */
    @Transactional
    HearingDetail recordResult(AuthenticatedUser user, UUID id, ResultData data) {
        Located located = findEditableLocated(user, id);
        Hearing hearing = located.hearing();
        String area = located.caseRef().practiceArea();
        if (HearingRules.isFinallyCancelled(hearing.getStatusCode())) {
            throw new HearingStateException("A cancelled hearing has no result");
        }
        if (data.nextHearing() != null && hearing.getNextHearingId() != null) {
            throw new HearingStateException("The hearing already has a next hearing");
        }
        String status = Text.clean(data.statusCode());
        HearingRules.requireResultStatus(status);
        String heldAs = Text.clean(data.heldAsTypeCode());
        catalogs.requireOffered(area, Catalog.HEARING_STATUSES, status, hearing.getStatusCode());
        if (heldAs != null) {
            catalogs.requireOffered(area, Catalog.HEARING_TYPES, heldAs, hearing.getHeldAsTypeCode());
        }
        ResultData.NextHearingData next = data.nextHearing();
        if (next != null) {
            catalogs.requireOffered(area, Catalog.HEARING_TYPES, Text.clean(next.typeCode()), null);
        }

        hearing.recordResult(status, heldAs, Text.clean(data.resultSummary()));
        if (next != null) {
            Hearing followUp = hearings.saveAndFlush(Hearing.create(hearing.getCaseId(), followUpOf(next)));
            addDefendants(followUp.getId(), attendableDefendants(activeDefendantIds(hearing.getId())));
            addLawyers(followUp.getId(), attendableLawyers(hearing.getCaseId(), activeLawyerIds(hearing.getId())));
            hearing.linkNextHearing(followUp.getId());
        }
        hearings.flush();
        return detail(user, hearing);
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID id) {
        Hearing hearing = find(user, id).hearing();
        cases.requireCanArchive(user);
        hearing.archive();
    }

    @Transactional
    void restore(AuthenticatedUser user, UUID id) {
        Located located = find(user, id);
        cases.requireCanArchive(user);
        requireNotArchived(located.caseRef());
        located.hearing().restore();
    }

    private HearingDetail detail(AuthenticatedUser user, Hearing hearing) {
        HearingView head = views.heads(user, List.of(hearing)).get(0);
        List<ClashView> hearingClashes = clashes.of(user, List.of(head)).get(hearing.getId());
        return views.detail(user, hearing, hearingClashes);
    }

    private static HearingData followUpOf(ResultData.NextHearingData next) {
        return new HearingData(
                next.typeCode(), next.startsAt(), next.durationMinutes(), next.room(), next.judge(),
                null, null, null, null, null, null, null, null, null);
    }

    private void requireCatalogCodes(String area, HearingData data, Hearing current) {
        String typeCode = Text.clean(data.typeCode());
        catalogs.requireOffered(area, Catalog.HEARING_TYPES, typeCode, current == null ? null : current.getTypeCode());
        catalogs.requireOffered(
                area,
                Catalog.HEARING_STATUSES,
                Hearing.statusOf(data, current == null ? null : current.getStatusCode()),
                current == null ? null : current.getStatusCode());
        String reason = Text.clean(data.cancellationReasonCode());
        if (reason != null) {
            catalogs.requireOffered(
                    area, Catalog.CANCELLATION_REASONS, reason, current == null ? null : current.getCancellationReasonCode());
        }
        String heldAs = Text.clean(data.heldAsTypeCode());
        if (heldAs != null) {
            catalogs.requireOffered(area, Catalog.HEARING_TYPES, heldAs, current == null ? null : current.getHeldAsTypeCode());
        }
    }

    /** For a follow-up: the defendants that are not archived. */
    private List<UUID> attendableDefendants(List<UUID> defendantIds) {
        Map<UUID, DefendantRef> found = cases.findDefendants(defendantIds);
        return defendantIds.stream().filter(id -> found.containsKey(id) && !found.get(id).archived()).toList();
    }

    /** For a follow-up: the lawyers still active, or the case's responsible when none is. */
    private List<UUID> attendableLawyers(UUID caseId, List<UUID> lawyerIds) {
        List<UUID> active = users.findAllById(lawyerIds).stream()
                .filter(AppUser::isActive)
                .map(AppUser::getId)
                .toList();
        return active.isEmpty() ? defaultLawyers(caseId) : active;
    }

    /**
     * The defendants must exist in the firm (else not found) and belong to the hearing's case (else 400).
     * An archived defendant is only rejected when it is new to the hearing ({@code attached} are kept).
     */
    private List<UUID> checkedDefendants(UUID caseId, List<UUID> defendantIds, Set<UUID> attached) {
        List<UUID> wanted = defendantIds == null ? List.of() : defendantIds.stream().distinct().toList();
        Map<UUID, DefendantRef> found = cases.findDefendants(wanted);
        for (UUID defendantId : wanted) {
            DefendantRef defendant = found.get(defendantId);
            if (defendant == null) {
                throw new HearingNotFoundException("There is no defendant " + defendantId);
            }
            if (!defendant.caseId().equals(caseId)) {
                throw new InvalidHearingDataException("The defendant " + defendantId + " is not in the hearing's case");
            }
            if (defendant.archived() && !attached.contains(defendantId)) {
                throw new InvalidHearingDataException("An archived defendant cannot attend a hearing");
            }
        }
        return wanted;
    }

    /**
     * The lawyers must be active members of the firm (a user of another firm does not exist). An
     * inactive user is only rejected when new to the hearing ({@code attached} are kept).
     */
    private List<UUID> checkedLawyers(List<UUID> lawyerIds, Set<UUID> attached) {
        List<UUID> wanted = lawyerIds.stream().distinct().toList();
        if (wanted.isEmpty()) {
            throw new InvalidHearingDataException("A hearing needs at least one lawyer");
        }
        Map<UUID, AppUser> found = users.findAllById(wanted).stream().collect(Collectors.toMap(AppUser::getId, user -> user));
        for (UUID userId : wanted) {
            AppUser member = found.get(userId);
            if (member == null) {
                throw new HearingNotFoundException("There is no user " + userId);
            }
            if (!member.isActive() && !attached.contains(userId)) {
                throw new InvalidHearingDataException("An archived user cannot attend a hearing");
            }
        }
        return wanted;
    }

    private List<UUID> defaultLawyers(UUID caseId) {
        return List.of(cases.responsibleOf(caseId)
                .orElseThrow(() -> new InvalidHearingDataException(
                        "The case has no responsible lawyer: say which lawyers attend")));
    }

    private void addDefendants(UUID hearingId, List<UUID> defendantIds) {
        defendantIds.forEach(defendantId -> hearingDefendants.save(HearingDefendant.create(hearingId, defendantId)));
    }

    private void addLawyers(UUID hearingId, List<UUID> lawyerIds) {
        lawyerIds.forEach(userId -> hearingLawyers.save(HearingLawyer.create(hearingId, userId)));
    }

    /** Rows of removed defendants are archived and new ones added, so the history stays in the table. */
    private void replaceDefendants(UUID hearingId, List<UUID> wanted) {
        List<HearingDefendant> current =
                hearingDefendants.findByHearingIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(hearingId);
        current.stream().filter(row -> !wanted.contains(row.getDefendantId())).forEach(HearingDefendant::archive);
        Set<UUID> kept = current.stream().map(HearingDefendant::getDefendantId).collect(Collectors.toSet());
        addDefendants(hearingId, wanted.stream().filter(id -> !kept.contains(id)).toList());
    }

    private void replaceLawyers(UUID hearingId, List<UUID> wanted) {
        List<HearingLawyer> current = hearingLawyers.findByHearingIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(hearingId);
        current.stream().filter(row -> !wanted.contains(row.getUserId())).forEach(HearingLawyer::archive);
        Set<UUID> kept = current.stream().map(HearingLawyer::getUserId).collect(Collectors.toSet());
        addLawyers(hearingId, wanted.stream().filter(id -> !kept.contains(id)).toList());
    }

    private List<UUID> activeDefendantIds(UUID hearingId) {
        return hearingDefendants.findByHearingIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(hearingId).stream()
                .map(HearingDefendant::getDefendantId)
                .toList();
    }

    private List<UUID> activeLawyerIds(UUID hearingId) {
        return hearingLawyers.findByHearingIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(hearingId).stream()
                .map(HearingLawyer::getUserId)
                .toList();
    }

    private CaseRef requireVisibleCase(AuthenticatedUser user, UUID caseId) {
        return cases.findVisible(user, caseId)
                .orElseThrow(() -> new HearingNotFoundException("There is no case " + caseId));
    }

    private static void requireNotArchived(CaseRef caseRef) {
        if (caseRef.archived()) {
            throw new ArchivedHearingRecordException("The case is archived: restore it before changing its hearings");
        }
    }

    private Located find(AuthenticatedUser user, UUID id) {
        Hearing hearing = hearings.findById(id).orElseThrow(() -> new HearingNotFoundException("There is no hearing " + id));
        return new Located(hearing, requireVisibleCase(user, hearing.getCaseId()));
    }

    private Hearing findEditable(AuthenticatedUser user, UUID id) {
        return findEditableLocated(user, id).hearing();
    }

    /** A visible hearing of a case that is not archived, and not archived itself, with its case. */
    private Located findEditableLocated(AuthenticatedUser user, UUID id) {
        Located located = find(user, id);
        requireNotArchived(located.caseRef());
        if (located.hearing().isArchived()) {
            throw new ArchivedHearingRecordException("The hearing is archived: restore it before changing it");
        }
        return located;
    }

    private record Located(Hearing hearing, CaseRef caseRef) {}
}
