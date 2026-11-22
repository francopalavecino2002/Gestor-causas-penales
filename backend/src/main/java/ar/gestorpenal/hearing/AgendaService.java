package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.security.AuthenticatedUser;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The hearing agenda of the current firm (ADR-0016): the hearings of a range of local days. Archived
 * hearings and cases, and reserved cases the user cannot see, are filtered in the query.
 */
@Service
class AgendaService {

    static final int MAX_DAYS = 31;

    /** Stands in for "no lawyer filter": the query ignores it when {@code filterByLawyer} is false. */
    private static final UUID NO_LAWYER = new UUID(0, 0);

    private final HearingRepository hearings;
    private final CoerciveMeasureRepository measures;
    private final HearingViews views;
    private final HearingClashes clashes;
    private final HearingCalendar calendar;
    private final Cases cases;

    AgendaService(
            HearingRepository hearings,
            CoerciveMeasureRepository measures,
            HearingViews views,
            HearingClashes clashes,
            HearingCalendar calendar,
            Cases cases) {
        this.hearings = hearings;
        this.measures = measures;
        this.views = views;
        this.clashes = clashes;
        this.calendar = calendar;
        this.cases = cases;
    }

    /**
     * {@code from} defaults to today and {@code to} (inclusive) to {@code from}; at most
     * {@value #MAX_DAYS} days. {@code lawyerId} keeps only the hearings that lawyer attends.
     */
    @Transactional(readOnly = true)
    AgendaView agenda(AuthenticatedUser user, LocalDate from, LocalDate to, UUID lawyerId) {
        LocalDate first = from == null ? calendar.today() : from;
        LocalDate last = to == null ? first : to;
        if (last.isBefore(first)) {
            throw new InvalidHearingDataException("The end of the range cannot be before its start");
        }
        if (ChronoUnit.DAYS.between(first, last) + 1 > MAX_DAYS) {
            throw new InvalidHearingDataException("The agenda shows at most " + MAX_DAYS + " days at a time");
        }
        List<Hearing> found = hearings.findAgenda(
                calendar.startOfDay(first),
                calendar.startOfDay(last.plusDays(1)),
                cases.seesEveryCase(user),
                user.userId(),
                lawyerId != null,
                lawyerId == null ? NO_LAWYER : lawyerId);
        List<HearingView> heads = views.heads(user, found);
        Map<UUID, List<ClashView>> clashesById = clashes.of(user, heads);
        Set<UUID> detainees = detaineesAmong(heads);
        List<AgendaItem> items = heads.stream()
                .map(head -> AgendaItem.of(
                        head,
                        head.defendants().stream().anyMatch(defendant -> detainees.contains(defendant.id())),
                        !clashesById.get(head.id()).isEmpty()))
                .toList();
        return new AgendaView(first, last, HearingCalendar.ZONE.getId(), items);
    }

    /** The defendants of the hearings that have an active custodial measure. */
    private Set<UUID> detaineesAmong(List<HearingView> heads) {
        List<UUID> defendantIds = heads.stream()
                .flatMap(head -> head.defendants().stream())
                .map(NamedRef::id)
                .distinct()
                .toList();
        if (defendantIds.isEmpty()) {
            return Set.of();
        }
        return Set.copyOf(measures.findDefendantsWithActiveMeasure(defendantIds, CustodialMeasures.CODES, calendar.today()));
    }
}
