package ar.gestorpenal.demo;

import ar.gestorpenal.casefile.CaseSeeding;
import ar.gestorpenal.demo.DemoData.DemoPerson;
import ar.gestorpenal.demo.DemoData.DemoUser;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
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
 * Creates the fictitious demo firm, its users, people and two cases at startup (profile {@code demo}).
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
    private final DemoProperties properties;

    DemoDataSeeder(
            TenantService tenants,
            UserService userService,
            UserRepository users,
            Persons persons,
            CaseSeeding caseSeeding,
            DemoProperties properties) {
        this.tenants = tenants;
        this.userService = userService;
        this.users = users;
        this.persons = persons;
        this.caseSeeding = caseSeeding;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        findOrCreateFirm().ifPresent(tenantId -> TenantContext.runAs(tenantId, () -> {
            createMissingUsers();
            createMissingCases();
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

    private UUID personId(DemoPerson person) {
        return persons.findOrRegisterHuman(person.firstNames(), person.lastNames()).id();
    }
}
