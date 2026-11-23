package ar.gestorpenal.demo;

import ar.gestorpenal.casefile.CaseSeeding;
import ar.gestorpenal.casefile.CaseSeeding.DefendantSeed;
import ar.gestorpenal.deadline.DeadlineSeeding;
import ar.gestorpenal.demo.DemoCases.CaseSpec;
import ar.gestorpenal.demo.DemoCases.DeadlineSpec;
import ar.gestorpenal.demo.DemoCases.DefendantSpec;
import ar.gestorpenal.demo.DemoCases.HearingSpec;
import ar.gestorpenal.demo.DemoCases.MeasureSpec;
import ar.gestorpenal.hearing.HearingSeeding;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.user.UserRepository;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Loads the cases of {@link DemoCases} into the current tenant. Like the seeder that calls it, it is
 * resumable: each case, its hearings, each defendant's measures and the case's deadlines are created
 * only when missing.
 */
@Component
@Profile("demo")
class DemoPortfolio {

    private static final Logger log = LoggerFactory.getLogger(DemoPortfolio.class);

    private final UserRepository users;
    private final Persons persons;
    private final CaseSeeding caseSeeding;
    private final HearingSeeding hearingSeeding;
    private final DeadlineSeeding deadlineSeeding;

    DemoPortfolio(
            UserRepository users,
            Persons persons,
            CaseSeeding caseSeeding,
            HearingSeeding hearingSeeding,
            DeadlineSeeding deadlineSeeding) {
        this.users = users;
        this.persons = persons;
        this.caseSeeding = caseSeeding;
        this.hearingSeeding = hearingSeeding;
        this.deadlineSeeding = deadlineSeeding;
    }

    /** Call it inside the demo firm's tenant scope, once its users exist. */
    void createMissingCases() {
        LocalDate today = hearingSeeding.today();
        DemoCases.CASES.forEach(spec -> createMissing(spec, today));
    }

    private void createMissing(CaseSpec spec, LocalDate today) {
        UUID responsibleId = users.findByEmail(spec.responsible().email()).orElseThrow().getId();
        UUID caseId = caseSeeding.findCaseId(spec.number()).orElseGet(() -> createCase(spec, responsibleId, today));
        List<UUID> defendantIds = caseSeeding.defendantIds(caseId);
        if (defendantIds.size() != spec.defendants().size()) {
            log.warn("Demo case {} has {} of its {} defendants (a run failed halfway?); its agenda was not seeded",
                    spec.number(), defendantIds.size(), spec.defendants().size());
            return;
        }

        if (!spec.hearings().isEmpty() && !hearingSeeding.hasHearings(caseId)) {
            spec.hearings().forEach(hearing -> createHearing(caseId, hearing, defendantIds, responsibleId, today));
        }
        spec.measures().stream()
                .filter(measure -> !hearingSeeding.hasMeasures(defendantIds.get(measure.defendant())))
                .forEach(measure -> createMeasure(measure, defendantIds, today));
        if (!spec.deadlines().isEmpty() && !deadlineSeeding.hasDeadlines(caseId)) {
            spec.deadlines().forEach(deadline -> createDeadline(caseId, deadline, defendantIds, today));
        }
    }

    private UUID createCase(CaseSpec spec, UUID responsibleId, LocalDate today) {
        UUID caseId = caseSeeding.createCase(
                responsibleId, spec.caption(), spec.number(), spec.circumscription(), spec.reserved());
        spec.defendants().forEach(defendant -> caseSeeding.addDefendant(caseId, seed(defendant, today)));
        log.info("Demo case created: {}", spec.number());
        return caseId;
    }

    private DefendantSeed seed(DefendantSpec defendant, LocalDate today) {
        UUID personId = persons.findOrRegisterHuman(
                        defendant.person().firstNames(), defendant.person().lastNames())
                .id();
        LocalDate chargesOn = defendant.chargesDaysAgo() == null ? null : today.minusDays(defendant.chargesDaysAgo());
        return new DefendantSeed(
                personId, defendant.stage(), defendant.status(), defendant.closingOutcome(),
                defendant.offence(), defendant.legalReference(), chargesOn, defendant.indigenousPeople());
    }

    private void createHearing(
            UUID caseId, HearingSpec hearing, List<UUID> defendantIds, UUID lawyerId, LocalDate today) {
        List<UUID> about = hearing.defendants().length == 0
                ? defendantIds
                : Arrays.stream(hearing.defendants()).mapToObj(defendantIds::get).toList();
        LocalDate day = DemoCalendar.weekday(today, hearing.weekday());
        hearingSeeding.createHearing(caseId, hearing.type(), hearingSeeding.at(day, hearing.time()),
                hearing.minutes(), hearing.room(), about, List.of(lawyerId));
    }

    private void createMeasure(MeasureSpec measure, List<UUID> defendantIds, LocalDate today) {
        hearingSeeding.createMeasure(
                defendantIds.get(measure.defendant()),
                measure.code(),
                measure.place(),
                measure.risks(),
                today.minusDays(measure.startedDaysAgo()),
                plusDays(today, measure.endsInDays()),
                plusDays(today, measure.reviewInDays()));
    }

    private void createDeadline(UUID caseId, DeadlineSpec deadline, List<UUID> defendantIds, LocalDate today) {
        UUID defendantId = deadline.defendant() == null ? null : defendantIds.get(deadline.defendant());
        deadlineSeeding.createDeadline(caseId, defendantId, deadline.rule(),
                today.minusDays(deadline.triggeredDaysAgo()), plusDays(today, deadline.dueInDays()), deadline.notes());
    }

    private static LocalDate plusDays(LocalDate today, Integer days) {
        return days == null ? null : today.plusDays(days);
    }
}
