package ar.gestorpenal.demo;

import ar.gestorpenal.demo.DemoData.DemoUser;
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
 * Creates the fictitious demo firm and its users at startup (profile {@code demo}). It is
 * resumable: it creates only what is missing, so a restart never duplicates anything and completes
 * a run that failed halfway. An archived demo firm is left alone. It is not transactional, because
 * {@link TenantContext#runAs} must start outside any transaction.
 */
@Component
@Profile("demo")
@EnableConfigurationProperties(DemoProperties.class)
class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final TenantService tenants;
    private final UserService userService;
    private final UserRepository users;
    private final DemoProperties properties;

    DemoDataSeeder(
            TenantService tenants, UserService userService, UserRepository users, DemoProperties properties) {
        this.tenants = tenants;
        this.userService = userService;
        this.users = users;
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        findOrCreateFirm().ifPresent(tenantId -> TenantContext.runAs(tenantId, this::createMissingUsers));
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
}
