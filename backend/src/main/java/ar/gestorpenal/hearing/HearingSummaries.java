package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.CaseHearingSummaries;
import ar.gestorpenal.casefile.NextHearing;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gives the case summary its detainee count and next hearing (ADR-0016). The case feature declares
 * the interface so it does not depend on this package.
 */
@Component
class HearingSummaries implements CaseHearingSummaries {

    private final CoerciveMeasureRepository measures;
    private final HearingRepository hearings;
    private final HearingCalendar calendar;

    HearingSummaries(CoerciveMeasureRepository measures, HearingRepository hearings, HearingCalendar calendar) {
        this.measures = measures;
        this.hearings = hearings;
        this.calendar = calendar;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, Integer> detaineeCounts(Collection<UUID> caseIds) {
        if (caseIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Integer> counts = new HashMap<>();
        for (Object[] row : measures.countDetaineesByCase(caseIds, CustodialMeasures.CODES, calendar.today())) {
            counts.put((UUID) row[0], ((Number) row[1]).intValue());
        }
        return counts;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, NextHearing> nextHearings(Collection<UUID> caseIds) {
        if (caseIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, NextHearing> next = new HashMap<>();
        // Soonest first, so the first hearing seen for a case is its next one.
        for (Hearing hearing : hearings.findUpcoming(caseIds, calendar.now(), HearingRules.NOT_PENDING)) {
            next.putIfAbsent(
                    hearing.getCaseId(), new NextHearing(hearing.getId(), hearing.getStartsAt(), hearing.getTypeCode()));
        }
        return next;
    }
}
