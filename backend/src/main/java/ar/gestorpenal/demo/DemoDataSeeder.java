package ar.gestorpenal.demo;

import ar.gestorpenal.casefile.CaseSeeding;
import ar.gestorpenal.deadline.DeadlineSeeding;
import ar.gestorpenal.demo.DemoData.DemoPerson;
import ar.gestorpenal.demo.DemoData.DemoUser;
import ar.gestorpenal.fee.JusValueSeeding;
import ar.gestorpenal.hearing.HearingSeeding;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.task.TaskSeeding;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Creates the fictitious demo firm, its users, people and about 25 cases at startup (profile
 * {@code demo}): the two original cases here, the rest from {@link DemoCases} through {@link DemoPortfolio}, and a handful of civil and
 * laboral ones ({@link DemoAreaCases}) through {@link DemoAreaPortfolio}.
 * It is resumable: it creates only what is missing, so a restart never duplicates anything and
 * completes a run that failed halfway. An archived demo firm is left alone. It is not transactional,
 * because {@link TenantContext#runAs} must start outside any transaction.
 */
@Component
@Profile("demo")
@EnableConfigurationProperties(DemoProperties.class)
class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private static final String CIRCUMSCRIPTION = "i-confluencia";

    private final TenantService tenants;
    private final UserService userService;
    private final UserRepository users;
    private final Persons persons;
    private final CaseSeeding caseSeeding;
    private final HearingSeeding hearingSeeding;
    private final DeadlineSeeding deadlineSeeding;
    private final TaskSeeding taskSeeding;
    private final JusValueSeeding jusValueSeeding;
    private final DemoPortfolio portfolio;
    private final DemoAreaPortfolio areaPortfolio;
    private final DemoProperties properties;

    DemoDataSeeder(
            TenantService tenants,
            UserService userService,
            UserRepository users,
            Persons persons,
            CaseSeeding caseSeeding,
            HearingSeeding hearingSeeding,
            DeadlineSeeding deadlineSeeding,
            TaskSeeding taskSeeding,
            JusValueSeeding jusValueSeeding,
            DemoPortfolio portfolio,
            DemoAreaPortfolio areaPortfolio,
            DemoProperties properties) {
        this.tenants = tenants;
        this.userService = userService;
        this.users = users;
        this.persons = persons;
        this.caseSeeding = caseSeeding;
        this.hearingSeeding = hearingSeeding;
        this.deadlineSeeding = deadlineSeeding;
        this.taskSeeding = taskSeeding;
        this.jusValueSeeding = jusValueSeeding;
        this.portfolio = portfolio;
        this.areaPortfolio = areaPortfolio;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        findOrCreateFirm().ifPresent(tenantId -> TenantContext.runAs(tenantId, () -> {
            createMissingUsers();
            createMissingCases();
            createMissingAgenda();
            createMissingTasks();
            createMissingJusValue();
            portfolio.createMissingCases();
            areaPortfolio.createMissingCases();
        }));
    }

    private Optional<UUID> findOrCreateFirm() {
        Optional<UUID> active = tenants.findActiveIdBySlug(DemoData.FIRM_SLUG);
        if (active.isPresent()) {
            return active;
        }
        if (tenants.isSlugTaken(DemoData.FIRM_SLUG)) {
            log.warn("Demo firm '{}' is archived; demo data was not seeded", DemoData.FIRM_SLUG);
            return Optional.empty();
        }
        log.info("Creating demo firm '{}'", DemoData.FIRM_SLUG);
        return Optional.of(tenants.create(DemoData.FIRM_NAME, DemoData.FIRM_SLUG).id());
    }

    private void createMissingUsers() {
        DemoData.USERS.stream()
                .filter(user -> users.findByEmail(user.email()).isEmpty())
                .forEach(this::createUser);
    }

    private void createUser(DemoUser user) {
        userService.createUser(user.email(), user.displayName(), properties.password(), user.role());
        log.info("Demo user created: {} ({})", user.email(), user.role());
    }

    /** Two cases: one with two defendants in different stages, and a reserved one the paralegal cannot see. */
    private void createMissingCases() {
        UUID lawyerId = users.findByEmail(DemoData.LAWYER.email()).orElseThrow().getId();
        if (!caseSeeding.caseExists(DemoData.OPEN_CASE_NUMBER)) {
            UUID caseId = caseSeeding.createCase(
                    lawyerId,
                    "Fernández Ruiz, Tomás y otra s/ robo agravado (ficticio)",
                    DemoData.OPEN_CASE_NUMBER,
                    CIRCUMSCRIPTION,
                    false);
            caseSeeding.addDefendant(caseId, personId(DemoData.TOMAS), "investigacion-preparatoria",
                    "Robo agravado", "CP art. 166 inc. 2");
            caseSeeding.addDefendant(caseId, personId(DemoData.GABRIELA), "etapa-intermedia",
                    "Encubrimiento", "CP art. 277");
            log.info("Demo case created: {}", DemoData.OPEN_CASE_NUMBER);
        }
        if (!caseSeeding.caseExists(DemoData.RESERVED_CASE_NUMBER)) {
            UUID caseId = caseSeeding.createCase(
                    lawyerId,
                    "Paz Ficticio, Nicolás s/ lesiones (ficticio, reservada)",
                    DemoData.RESERVED_CASE_NUMBER,
                    CIRCUMSCRIPTION,
                    true);
            caseSeeding.addDefendant(caseId, personId(DemoData.NICOLAS), "averiguacion-preliminar",
                    "Lesiones leves", "CP art. 89");
            log.info("Demo case created: {} (reserved)", DemoData.RESERVED_CASE_NUMBER);
        }
    }

    /**
     * Hearings this week and next, relative to today so the agenda is never empty: two of the
     * lawyer's hearings overlap (one is in the reserved case, to show the masked clash), plus a
     * preventive prison with a fixed end and a next review, and a periodic appearance.
     */
    private void createMissingAgenda() {
        UUID lawyerId = users.findByEmail(DemoData.LAWYER.email()).orElseThrow().getId();
        UUID ownerId = users.findByEmail(DemoData.OWNER.email()).orElseThrow().getId();
        UUID openCaseId = caseSeeding.findCaseId(DemoData.OPEN_CASE_NUMBER).orElseThrow();
        UUID reservedCaseId = caseSeeding.findCaseId(DemoData.RESERVED_CASE_NUMBER).orElseThrow();
        List<UUID> openDefendants = caseSeeding.defendantIds(openCaseId);
        List<UUID> reservedDefendants = caseSeeding.defendantIds(reservedCaseId);
        LocalDate today = hearingSeeding.today();

        if (!hearingSeeding.hasHearings(openCaseId)) {
            hearingSeeding.createHearing(openCaseId, "formulacion-de-cargos",
                    hearingSeeding.at(today.plusDays(1), LocalTime.of(9, 0)), 60, "Sala 4",
                    List.of(openDefendants.get(0)), List.of(lawyerId));
            hearingSeeding.createHearing(openCaseId, "control-de-acusacion",
                    hearingSeeding.at(today.plusDays(3), LocalTime.of(11, 0)), 90, "Sala 2",
                    List.of(openDefendants.get(1)), List.of(ownerId));
            hearingSeeding.createHearing(openCaseId, "preparacion-del-juicio",
                    hearingSeeding.at(today.plusDays(8), LocalTime.of(10, 0)), 60, "Sala 1",
                    openDefendants, List.of(lawyerId));
            log.info("Demo hearings created for {}", DemoData.OPEN_CASE_NUMBER);
        }
        if (!hearingSeeding.hasHearings(reservedCaseId)) {
            hearingSeeding.createHearing(reservedCaseId, "control-de-la-investigacion",
                    hearingSeeding.at(today.plusDays(1), LocalTime.of(9, 30)), 60, "Sala 3",
                    reservedDefendants, List.of(lawyerId));
            log.info("Demo hearing created for {} (clashes with the lawyer's other hearing)", DemoData.RESERVED_CASE_NUMBER);
        }
        if (!hearingSeeding.hasMeasures(openDefendants.get(0))) {
            hearingSeeding.createMeasure(openDefendants.get(0), "prision-preventiva",
                    "Unidad de detención ficticia", List.of("peligro-de-fuga"),
                    today.minusDays(20), today.plusDays(40), today.plusDays(10));
        }
        if (!hearingSeeding.hasMeasures(openDefendants.get(1))) {
            hearingSeeding.createMeasure(openDefendants.get(1), "presentacion-periodica",
                    null, List.of(), today.minusDays(5), null, null);
        }
        createMissingDeadlines(openCaseId, openDefendants.get(0), today);
    }

    /**
     * Deadlines of the open case, relative to today: the detained defendant's preventive prison (the
     * duration the judge set and the one-year maximum), an investigation about to expire and an
     * ordinary appeal counted in business days.
     */
    private void createMissingDeadlines(UUID caseId, UUID detainedDefendantId, LocalDate today) {
        if (deadlineSeeding.hasDeadlines(caseId)) {
            return;
        }
        deadlineSeeding.createDeadline(caseId, detainedDefendantId, "duracion-fijada-prision-preventiva",
                today.minusDays(20), today.plusDays(40));
        deadlineSeeding.createDeadline(caseId, detainedDefendantId, "duracion-maxima-prision-preventiva",
                today.minusDays(20), null);
        deadlineSeeding.createDeadline(caseId, detainedDefendantId, "investigacion-preparatoria",
                today.minusMonths(4).plusDays(10), null);
        deadlineSeeding.createDeadline(caseId, null, "impugnacion-ordinaria", today.minusDays(1), null);
        log.info("Demo deadlines created for {}", DemoData.OPEN_CASE_NUMBER);
    }

    /**
     * Tasks relative to today: two overdue, two due today and two later, some tied to the open case.
     * The demo firm has no tasks until the first run; after that it leaves them alone.
     */
    private void createMissingTasks() {
        if (taskSeeding.hasTasks()) {
            return;
        }
        UUID ownerId = users.findByEmail(DemoData.OWNER.email()).orElseThrow().getId();
        UUID lawyerId = users.findByEmail(DemoData.LAWYER.email()).orElseThrow().getId();
        UUID paralegalId = users.findByEmail(DemoData.PARALEGAL.email()).orElseThrow().getId();
        UUID openCaseId = caseSeeding.findCaseId(DemoData.OPEN_CASE_NUMBER).orElseThrow();
        LocalDate today = taskSeeding.today();

        taskSeeding.createTask(lawyerId, paralegalId, "Pedir copias del legajo en mesa de entradas", today.minusDays(2), openCaseId);
        taskSeeding.createTask(lawyerId, lawyerId, "Preparar el alegato de la audiencia", today.minusDays(1), openCaseId);
        taskSeeding.createTask(ownerId, lawyerId, "Llamar al cliente para confirmar la audiencia", today, openCaseId);
        taskSeeding.createTask(ownerId, paralegalId, "Presentar el escrito de prórroga", today, openCaseId);
        taskSeeding.createTask(lawyerId, paralegalId, "Actualizar el cuaderno de notificaciones", today.plusDays(3), null);
        taskSeeding.createTask(ownerId, ownerId, "Renovar el seguro de responsabilidad profesional", today.plusDays(20), null);
        log.info("Demo tasks created");
    }

    /**
     * The value of the JUS the fees calculator needs. From jusneuquen.gov.ar, read on 2026-11-25
     * [validar: confirm the current value at the source]. The demo firm has none until the first run;
     * after that it leaves them alone.
     */
    private void createMissingJusValue() {
        if (jusValueSeeding.hasJusValues()) {
            return;
        }
        UUID ownerId = users.findByEmail(DemoData.OWNER.email()).orElseThrow().getId();
        jusValueSeeding.createJusValue(ownerId, new BigDecimal("94963.25"), LocalDate.of(2026, 7, 1));
        log.info("Demo JUS value created");
    }

    private UUID personId(DemoPerson person) {
        return persons.findOrRegisterHuman(person.firstNames(), person.lastNames()).id();
    }
}
