package ar.gestorpenal.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.bootstrap.FirstFirmBootstrap.FirstFirm;
import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * The first firm on an empty database (T66). The methods run in order on one database of their own:
 * invalid values first (nothing is created), then two runs at once (one firm), then a later run
 * (refused).
 */
@SpringBootTest
@Import(EmptyDatabaseConfiguration.class)
@TestMethodOrder(OrderAnnotation.class)
class FirstFirmBootstrapTests {

    private static final FirstFirmRequest REQUEST = new FirstFirmRequest(
            " Estudio Ficticio Primero ", " estudio-ficticio ", " Titular.Ficticia@Ejemplo.TEST ", " Titular Ficticia ");

    @Autowired
    private FirstFirmBootstrap bootstrap;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserRepository users;

    @Autowired
    private AuditTrail auditTrail;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @Order(1)
    void shouldRefuseMissingOrInvalidValuesAndCreateNothing() {
        assertThatThrownBy(() -> bootstrap.create(new FirstFirmRequest(null, "Con Espacios", "sin-arroba", " ")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("BOOTSTRAP_FIRM_NAME")
                .hasMessageContaining("BOOTSTRAP_FIRM_SLUG")
                .hasMessageContaining("BOOTSTRAP_OWNER_EMAIL")
                .hasMessageContaining("BOOTSTRAP_OWNER_NAME");
        assertThatThrownBy(() -> bootstrap.create(new FirstFirmRequest(
                        "Estudio", "a".repeat(64), "titular@ejemplo.test", "Titular")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("BOOTSTRAP_FIRM_SLUG");

        assertThat(count("tenant")).isZero();
        assertThat(count("app_user")).isZero();
    }

    @Test
    @Order(2)
    void shouldCreateOneFirmAndOwnerWhenTwoRunsStartAtOnce() throws Exception {
        List<Object> outcomes = runTwiceAtOnce();

        List<FirstFirm> created = outcomes.stream()
                .filter(FirstFirm.class::isInstance).map(FirstFirm.class::cast).toList();
        assertThat(created).hasSize(1);
        assertThat(outcomes).filteredOn(FirmAlreadyExistsException.class::isInstance).hasSize(1);
        assertThat(count("tenant")).isEqualTo(1);
        assertThat(count("app_user")).isEqualTo(1);

        FirstFirm firm = created.getFirst();
        assertThat(firm.firmSlug()).isEqualTo("estudio-ficticio");
        assertThat(firm.ownerEmail()).isEqualTo("titular.ficticia@ejemplo.test");
        assertThat(firm.toString()).doesNotContain(firm.temporaryPassword());
        assertThat(tenants.findActiveIdBySlug("estudio-ficticio")).contains(firm.tenantId());
        assertThat(tenants.describe(firm.tenantId()).orElseThrow().name()).isEqualTo("Estudio Ficticio Primero");

        TenantContext.runAs(firm.tenantId(), () -> {
            AppUser owner = users.findByEmail("titular.ficticia@ejemplo.test").orElseThrow();
            assertThat(owner.getId()).isEqualTo(firm.ownerId());
            assertThat(owner.getRole()).isEqualTo(Role.OWNER);
            assertThat(owner.getDisplayName()).isEqualTo("Titular Ficticia");
            assertThat(owner.isActive()).isTrue();
            assertThat(owner.isPasswordChangeRequired()).isTrue();
            assertThat(passwordEncoder.matches(firm.temporaryPassword(), owner.getPasswordHash())).isTrue();
        });
    }

    @Test
    @Order(3)
    void shouldRecordBothCreationsInTheFirmsHistoryWithoutAnAuthor() {
        var firmId = tenants.findActiveIdBySlug("estudio-ficticio").orElseThrow();

        TenantContext.runAs(firmId, () -> {
            List<AuditEvent> firmHistory = auditTrail.historyOf(Tenant.class, firmId);
            assertThat(firmHistory).singleElement().satisfies(event -> {
                assertThat(event.getAction()).isEqualTo(AuditAction.CREATE);
                assertThat(event.getActorUserId()).isNull();
                assertThat(event.getChanges()).contains(
                        new FieldChange("name", null, "Estudio Ficticio Primero"),
                        new FieldChange("slug", null, "estudio-ficticio"));
            });
            AppUser owner = users.findByEmail("titular.ficticia@ejemplo.test").orElseThrow();
            List<AuditEvent> ownerHistory = auditTrail.historyOf(AppUser.class, owner.getId());
            assertThat(ownerHistory).singleElement().satisfies(event -> {
                assertThat(event.getAction()).isEqualTo(AuditAction.CREATE);
                assertThat(event.getActorUserId()).isNull();
                assertThat(event.getChanges()).contains(new FieldChange("role", null, "OWNER"));
            });
        });
    }

    @Test
    @Order(4)
    void shouldRefuseOnceAFirmExists() {
        assertThatThrownBy(() -> bootstrap.create(new FirstFirmRequest(
                        "Otro Estudio Ficticio", "otro-estudio", "otra@ejemplo.test", "Otra Titular")))
                .isInstanceOf(FirmAlreadyExistsException.class);

        assertThat(count("tenant")).isEqualTo(1);
        assertThat(count("app_user")).isEqualTo(1);
        assertThat(tenants.isSlugTaken("otro-estudio")).isFalse();
    }

    @Test
    @Order(5)
    void shouldRefuseEvenWhenTheOnlyFirmIsArchived() {
        jdbc.update("UPDATE tenant SET archived_at = now() WHERE slug = 'estudio-ficticio'");

        assertThatThrownBy(() -> bootstrap.create(new FirstFirmRequest(
                        "Otro Estudio Ficticio", "otro-estudio", "otra@ejemplo.test", "Otra Titular")))
                .isInstanceOf(FirmAlreadyExistsException.class);
        assertThat(count("tenant")).isEqualTo(1);
    }

    /** Each outcome is the created firm or the exception the run threw. */
    private List<Object> runTwiceAtOnce() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            List<Future<Object>> runs = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                runs.add(pool.submit(() -> {
                    start.await();
                    try {
                        return bootstrap.create(REQUEST);
                    } catch (RuntimeException e) {
                        return e;
                    }
                }));
            }
            start.countDown();
            List<Object> outcomes = new ArrayList<>();
            for (Future<Object> run : runs) {
                outcomes.add(run.get(30, TimeUnit.SECONDS));
            }
            return outcomes;
        }
    }

    private long count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
    }
}
