package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.hearing.ClashDetector.Booking;
import ar.gestorpenal.security.AuthenticatedUser;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Loads the hearings that can overlap the given ones and lets {@link ClashDetector} decide (ADR-0016).
 * Clashes are warnings: they are reported next to the hearing, never raised as errors.
 */
@Component
class HearingClashes {

    /** No hearing lasts longer than this (database check), so none that starts earlier can overlap. */
    private static final Duration LONGEST_HEARING = Duration.ofMinutes(1440);

    private final HearingRepository hearings;
    private final HearingLawyerRepository hearingLawyers;
    private final Cases cases;

    HearingClashes(HearingRepository hearings, HearingLawyerRepository hearingLawyers, Cases cases) {
        this.hearings = hearings;
        this.hearingLawyers = hearingLawyers;
        this.cases = cases;
    }

    /**
     * The clashes of each hearing, by hearing id; every given hearing has an entry, empty when it does
     * not clash. An archived, cancelled or suspended hearing never clashes. Hearings of a reserved
     * case {@code user} cannot see are reported masked.
     */
    Map<UUID, List<ClashView>> of(AuthenticatedUser user, List<HearingView> subjects) {
        Map<UUID, List<ClashView>> result = new HashMap<>();
        subjects.forEach(subject -> result.put(subject.id(), List.of()));
        List<HearingView> clashable = subjects.stream()
                .filter(subject -> !subject.archived() && ClashDetector.canClash(subject.statusCode()))
                .filter(subject -> !subject.lawyers().isEmpty())
                .toList();
        if (clashable.isEmpty()) {
            return result;
        }
        Map<UUID, Hearing> candidates = candidatesNear(clashable);
        List<Booking> others = bookingsOf(candidates);
        Map<UUID, CaseRef> caseRefs =
                cases.findAll(user, candidates.values().stream().map(Hearing::getCaseId).distinct().toList());

        for (HearingView subject : clashable) {
            List<ClashView> clashes = new ArrayList<>();
            for (NamedRef lawyer : subject.lawyers()) {
                Booking booking = new Booking(subject.id(), lawyer.id(), subject.startsAt(), subject.durationMinutes());
                for (Booking other : ClashDetector.clashesOf(booking, others)) {
                    Hearing hearing = candidates.get(other.hearingId());
                    clashes.add(view(other.userId(), hearing, caseRefs.get(hearing.getCaseId())));
                }
            }
            clashes.sort(Comparator.comparing(ClashView::startsAt).thenComparing(ClashView::hearingId));
            result.put(subject.id(), List.copyOf(clashes));
        }
        return result;
    }

    /** Every not archived, clashable hearing of the subjects' lawyers that starts close enough to overlap one of them. */
    private Map<UUID, Hearing> candidatesNear(List<HearingView> subjects) {
        List<UUID> userIds = subjects.stream()
                .flatMap(subject -> subject.lawyers().stream())
                .map(NamedRef::id)
                .distinct()
                .toList();
        Instant windowStart = subjects.stream()
                .map(HearingView::startsAt)
                .min(Comparator.naturalOrder())
                .orElseThrow()
                .minus(LONGEST_HEARING);
        Instant windowEnd = subjects.stream()
                .map(subject -> subject.startsAt().plus(Duration.ofMinutes(subject.durationMinutes())))
                .max(Comparator.naturalOrder())
                .orElseThrow();
        return hearings.findClashCandidates(userIds, HearingRules.NOT_HELD, windowStart, windowEnd).stream()
                .collect(Collectors.toMap(Hearing::getId, Function.identity()));
    }

    /** One booking per candidate hearing and attending lawyer. */
    private List<Booking> bookingsOf(Map<UUID, Hearing> candidates) {
        if (candidates.isEmpty()) {
            return List.of();
        }
        return hearingLawyers
                .findByHearingIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(candidates.keySet())
                .stream()
                .map(row -> {
                    Hearing hearing = candidates.get(row.getHearingId());
                    return new Booking(hearing.getId(), row.getUserId(), hearing.getStartsAt(), hearing.getDurationMinutes());
                })
                .toList();
    }

    private static ClashView view(UUID userId, Hearing hearing, CaseRef caseRef) {
        boolean visible = caseRef != null && caseRef.visible();
        return new ClashView(
                hearing.getId(),
                userId,
                hearing.getStartsAt(),
                visible ? caseRef.id() : null,
                visible ? caseRef.caption() : null,
                !visible);
    }
}
