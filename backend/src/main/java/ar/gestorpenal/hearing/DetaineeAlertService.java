package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.casefile.DefendantRef;
import ar.gestorpenal.hearing.DetaineeAlerts.Alert;
import ar.gestorpenal.hearing.DetaineeAlerts.MeasureDates;
import ar.gestorpenal.jurisdiction.PracticeAreas;
import ar.gestorpenal.jurisdiction.PracticeModule;
import ar.gestorpenal.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assisted alerts about the firm's detainees (ADR-0016), for active custodial measures of cases and
 * defendants that are not archived and that the user may see, in practice areas that have the
 * {@code detainee-alerts} module (ADR-0032). Not the deadline engine of T14.
 */
@Service
class DetaineeAlertService {

    static final int DEFAULT_WITHIN_DAYS = 15;
    static final int MAX_WITHIN_DAYS = 90;

    private final CoerciveMeasureRepository measures;
    private final HearingCalendar calendar;
    private final Cases cases;
    private final PracticeAreas areas;

    DetaineeAlertService(
            CoerciveMeasureRepository measures, HearingCalendar calendar, Cases cases, PracticeAreas areas) {
        this.measures = measures;
        this.calendar = calendar;
        this.cases = cases;
        this.areas = areas;
    }

    /** Alerts due within {@code withinDays} (1 to 90) or already overdue, the most urgent first. */
    @Transactional(readOnly = true)
    List<DetaineeAlertView> alerts(AuthenticatedUser user, int withinDays) {
        if (withinDays < 1 || withinDays > MAX_WITHIN_DAYS) {
            throw new InvalidHearingDataException("withinDays must be between 1 and " + MAX_WITHIN_DAYS);
        }
        LocalDate today = calendar.today();
        List<CoerciveMeasure> active =
                measures.findActiveVisible(CustodialMeasures.CODES, today, cases.seesEveryCase(user), user.userId());
        if (active.isEmpty()) {
            return List.of();
        }
        Map<UUID, DefendantRef> defendants =
                cases.findDefendants(active.stream().map(CoerciveMeasure::getDefendantId).distinct().toList());
        Map<UUID, CaseRef> caseRefs =
                cases.findAll(user, defendants.values().stream().map(DefendantRef::caseId).distinct().toList());

        List<DetaineeAlertView> alerts = new ArrayList<>();
        for (CoerciveMeasure measure : active) {
            DefendantRef defendant = defendants.get(measure.getDefendantId());
            CaseRef caseRef = caseRefs.get(defendant.caseId());
            if (!areas.hasModule(caseRef.practiceArea(), PracticeModule.DETAINEE_ALERTS)) {
                continue;
            }
            MeasureDates dates = new MeasureDates(
                    measure.getMeasureCode(), measure.getStartsOn(), measure.getEndsOn(), measure.getNextReviewOn());
            for (Alert alert : DetaineeAlerts.of(dates, today, withinDays)) {
                alerts.add(new DetaineeAlertView(
                        alert.kind(),
                        alert.dueOn(),
                        alert.daysLeft(),
                        alert.article(),
                        caseRef.id(),
                        caseRef.caption(),
                        defendant.id(),
                        defendant.displayName(),
                        measure.getId(),
                        DetaineeAlerts.DISCLAIMER));
            }
        }
        alerts.sort(Comparator.comparing(DetaineeAlertView::daysLeft, DetaineeAlerts.MOST_URGENT_FIRST)
                .thenComparing(DetaineeAlertView::measureId)
                .thenComparing(DetaineeAlertView::kind));
        return alerts;
    }
}
