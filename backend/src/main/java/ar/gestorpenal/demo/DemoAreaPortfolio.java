package ar.gestorpenal.demo;

import ar.gestorpenal.casefile.CaseSeeding;
import ar.gestorpenal.casefile.CaseSeeding.AreaCaseSeed;
import ar.gestorpenal.deadline.DeadlineSeeding;
import ar.gestorpenal.demo.DemoAreaCases.AreaCaseSpec;
import ar.gestorpenal.demo.DemoAreaCases.AreaHearing;
import ar.gestorpenal.demo.DemoAreaCases.ManualDeadline;
import ar.gestorpenal.demo.DemoAreaCases.PartyName;
import ar.gestorpenal.demo.DemoAreaCases.PartySpec;
import ar.gestorpenal.hearing.HearingSeeding;
import ar.gestorpenal.jurisdiction.PracticeAreaSeeding;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.user.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Turns on the civil and laboral areas of the demo firm and loads the cases of {@link DemoAreaCases}.
 * Like the rest of the demo it is resumable: each case, party, hearing and set of deadlines is created
 * only when missing.
 */
@Component
@Profile("demo")
class DemoAreaPortfolio {

    private static final Logger log = LoggerFactory.getLogger(DemoAreaPortfolio.class);

    private final UserRepository users;
    private final Persons persons;
    private final PracticeAreaSeeding practiceAreas;
    private final CaseSeeding caseSeeding;
    private final HearingSeeding hearingSeeding;
    private final DeadlineSeeding deadlineSeeding;

    DemoAreaPortfolio(
            UserRepository users,
            Persons persons,
            PracticeAreaSeeding practiceAreas,
            CaseSeeding caseSeeding,
            HearingSeeding hearingSeeding,
            DeadlineSeeding deadlineSeeding) {
        this.users = users;
        this.persons = persons;
        this.practiceAreas = practiceAreas;
        this.caseSeeding = caseSeeding;
        this.hearingSeeding = hearingSeeding;
        this.deadlineSeeding = deadlineSeeding;
    }

    /** Call it inside the demo firm's tenant scope, once its users exist. */
    void createMissingCases() {
        practiceAreas.enable(DemoAreaCases.CIVIL, DemoAreaCases.LABORAL);
        LocalDate today = hearingSeeding.today();
        DemoAreaCases.CASES.forEach(spec -> createMissing(spec, today));
    }

    private void createMissing(AreaCaseSpec spec, LocalDate today) {
        UUID responsibleId = users.findByEmail(spec.responsible().email()).orElseThrow().getId();
        UUID caseId = caseSeeding.findCaseId(spec.number()).orElseGet(() -> createCase(spec, responsibleId));
        spec.parties().forEach(party -> addMissingParty(caseId, party));
        if (!hearingSeeding.hasHearings(caseId)) {
            createHearing(caseId, spec.hearing(), responsibleId, today);
        }
        if (!deadlineSeeding.hasDeadlines(caseId)) {
            spec.deadlines().forEach(deadline -> createDeadline(caseId, spec.area(), deadline, today));
        }
    }

    private UUID createCase(AreaCaseSpec spec, UUID responsibleId) {
        UUID caseId = caseSeeding.createAreaCase(
                new AreaCaseSeed(
                        spec.area(), spec.caption(), spec.number(), spec.circumscription(),
                        spec.actionType(), spec.represents(), spec.stage()),
                responsibleId);
        log.info("Demo case created: {} ({})", spec.number(), spec.area());
        return caseId;
    }

    private void addMissingParty(UUID caseId, PartySpec party) {
        UUID personId = personId(party.name());
        if (!caseSeeding.hasParty(caseId, personId, party.role())) {
            caseSeeding.addParty(caseId, personId, party.role());
        }
    }

    private UUID personId(PartyName name) {
        return name.isLegalEntity()
                ? persons.findOrRegisterLegalEntity(name.legalName()).id()
                : persons.findOrRegisterHuman(name.firstNames(), name.lastNames()).id();
    }

    private void createHearing(UUID caseId, AreaHearing hearing, UUID lawyerId, LocalDate today) {
        LocalDate day = DemoCalendar.weekday(today, hearing.weekday());
        hearingSeeding.createHearing(caseId, hearing.type(), hearingSeeding.at(day, hearing.time()),
                hearing.minutes(), hearing.room(), List.of(), List.of(lawyerId));
    }

    private void createDeadline(UUID caseId, String area, ManualDeadline deadline, LocalDate today) {
        deadlineSeeding.createManualDeadline(caseId, area, today.minusDays(deadline.triggeredDaysAgo()),
                today.plusDays(deadline.dueInDays()), deadline.notes());
    }
}
