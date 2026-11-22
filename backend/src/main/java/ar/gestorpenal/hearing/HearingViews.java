package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.casefile.DefendantRef;
import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.CatalogItem;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Builds what the API shows from the entities, with one query per kind of related row for the whole
 * list. It runs inside the caller's transaction, so the repositories only see the current firm's rows.
 */
@Component
class HearingViews {

    private final HearingDefendantRepository hearingDefendants;
    private final HearingLawyerRepository hearingLawyers;
    private final HearingRescheduleRepository reschedules;
    private final HearingCatalogs catalogs;
    private final Cases cases;
    private final UserRepository users;

    HearingViews(
            HearingDefendantRepository hearingDefendants,
            HearingLawyerRepository hearingLawyers,
            HearingRescheduleRepository reschedules,
            HearingCatalogs catalogs,
            Cases cases,
            UserRepository users) {
        this.hearingDefendants = hearingDefendants;
        this.hearingLawyers = hearingLawyers;
        this.reschedules = reschedules;
        this.catalogs = catalogs;
        this.cases = cases;
        this.users = users;
    }

    /** The hearings in the order given. The hearings' cases must be visible to {@code user}. */
    List<HearingView> heads(AuthenticatedUser user, List<Hearing> hearings) {
        if (hearings.isEmpty()) {
            return List.of();
        }
        List<UUID> hearingIds = hearings.stream().map(Hearing::getId).toList();
        Map<UUID, List<HearingDefendant>> defendantRows = hearingDefendants
                .findByHearingIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(hearingIds)
                .stream()
                .collect(Collectors.groupingBy(HearingDefendant::getHearingId));
        Map<UUID, List<HearingLawyer>> lawyerRows = hearingLawyers
                .findByHearingIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(hearingIds)
                .stream()
                .collect(Collectors.groupingBy(HearingLawyer::getHearingId));

        Map<UUID, DefendantRef> defendants = cases.findDefendants(distinct(
                defendantRows.values().stream().flatMap(List::stream).map(HearingDefendant::getDefendantId).toList()));
        Map<UUID, String> lawyerNames = users
                .findAllById(distinct(
                        lawyerRows.values().stream().flatMap(List::stream).map(HearingLawyer::getUserId).toList()))
                .stream()
                .collect(Collectors.toMap(AppUser::getId, AppUser::getDisplayName));
        Map<UUID, CaseRef> caseRefs = cases.findAll(user, distinct(hearings.stream().map(Hearing::getCaseId).toList()));
        Map<String, CatalogItem> types = catalogs.items(Catalog.HEARING_TYPES);
        Map<String, String> statuses = catalogs.names(Catalog.HEARING_STATUSES);
        Map<String, String> reasons = catalogs.names(Catalog.CANCELLATION_REASONS);

        return hearings.stream()
                .map(hearing -> {
                    CatalogItem type = types.get(hearing.getTypeCode());
                    CatalogItem heldAs = hearing.getHeldAsTypeCode() == null ? null : types.get(hearing.getHeldAsTypeCode());
                    CaseRef caseRef = caseRefs.get(hearing.getCaseId());
                    return new HearingView(
                            hearing.getId(),
                            hearing.getCaseId(),
                            caseRef == null ? null : caseRef.caption(),
                            hearing.getTypeCode(),
                            type == null ? hearing.getTypeCode() : type.name(),
                            type == null ? null : type.article(),
                            hearing.getStartsAt(),
                            hearing.getDurationMinutes(),
                            hearing.getRoom(),
                            hearing.getJudge(),
                            hearing.getOfijuReference(),
                            hearing.getRequestedBy(),
                            hearing.getStatusCode(),
                            nameOf(statuses, hearing.getStatusCode()),
                            hearing.getCancellationReasonCode(),
                            nameOf(reasons, hearing.getCancellationReasonCode()),
                            hearing.getHeldAsTypeCode(),
                            heldAs == null ? hearing.getHeldAsTypeCode() : heldAs.name(),
                            hearing.getResultSummary(),
                            hearing.getNextHearingId(),
                            hearing.getNotes(),
                            hearing.isArchived(),
                            hearing.getCreatedAt(),
                            defendantRows.getOrDefault(hearing.getId(), List.of()).stream()
                                    .map(row -> defendants.get(row.getDefendantId()))
                                    .map(defendant -> new NamedRef(defendant.id(), defendant.displayName()))
                                    .toList(),
                            lawyerRows.getOrDefault(hearing.getId(), List.of()).stream()
                                    .map(row -> new NamedRef(row.getUserId(), lawyerNames.get(row.getUserId())))
                                    .toList());
                })
                .toList();
    }

    /** One hearing with its clashes and its reschedule history, newest first. */
    HearingDetail detail(AuthenticatedUser user, Hearing hearing, List<ClashView> clashes) {
        HearingView head = heads(user, List.of(hearing)).get(0);
        List<RescheduleView> history = reschedules.findByHearingIdOrderByCreatedAtDescIdDesc(hearing.getId()).stream()
                .map(RescheduleView::of)
                .toList();
        return HearingDetail.of(head, clashes, history);
    }

    private static Collection<UUID> distinct(Collection<UUID> ids) {
        return ids.stream().distinct().toList();
    }

    /** The catalog name, or the code itself when the catalog no longer lists it. */
    private static String nameOf(Map<String, String> names, String code) {
        return code == null ? null : names.getOrDefault(code, code);
    }
}
