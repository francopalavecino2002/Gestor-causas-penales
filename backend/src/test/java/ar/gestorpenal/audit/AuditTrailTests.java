package ar.gestorpenal.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import ar.gestorpenal.user.UserService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;

/** The change history and the "archive instead of delete" rule, against a real database. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AuditTrailTests {

    private static final String PASSWORD = "clave-ficticia-larga";

    @Autowired
    private AuditTrail auditTrail;

    @Autowired
    private AuditProbeRepository probes;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository users;

    @Autowired
    private TenantService tenants;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID tenantA;
    private UUID tenantB;
    private AppUser lawyer;

    @BeforeEach
    void createFirmWithOneUser() {
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        lawyer = TenantContext.callAs(tenantA,
                () -> userService.createUser("abogada@ejemplo.test", "Abogada Ficticia", PASSWORD, Role.LAWYER));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldRecordACreationWithItsValuesAndNoActorOutsideARequest() {
        AuditProbe probe = createProbe("Legajo ficticio", "dato-secreto");

        List<AuditEvent> history = historyOf(probe);

        assertThat(history).singleElement().satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(AuditAction.CREATE);
            assertThat(event.getTenantId()).isEqualTo(tenantA);
            assertThat(event.getEntityType()).isEqualTo("AuditProbe");
            assertThat(event.getActorUserId()).isNull();
            assertThat(event.getOccurredAt()).isNotNull();
            assertThat(event.getChanges()).containsExactlyInAnyOrder(
                    new FieldChange("label", null, "Legajo ficticio"),
                    new FieldChange("secret", null, FieldChange.REDACTED),
                    new FieldChange("owner", null, lawyer.getId().toString()));
        });
    }

    @Test
    void shouldRecordOnlyTheChangedFieldsWithOldAndNewValues() {
        AuditProbe probe = createProbe("Antes", null);

        modifyProbe(probe, p -> {
            p.setLabel("Después");
            p.setSecret("nuevo-secreto");
        });

        assertThat(historyOf(probe)).last().satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(AuditAction.UPDATE);
            assertThat(event.getChanges()).containsExactlyInAnyOrder(
                    new FieldChange("label", "Antes", "Después"),
                    new FieldChange("secret", null, FieldChange.REDACTED));
        });
    }

    @Test
    void shouldRecordAChangedAssociationByItsId() {
        AuditProbe probe = createProbe("Legajo", null);
        AppUser otherLawyer = TenantContext.callAs(tenantA,
                () -> userService.createUser("otro@ejemplo.test", "Otro Ficticio", PASSWORD, Role.LAWYER));

        TenantContext.runAs(tenantA, () -> transactionTemplate.executeWithoutResult(status -> {
            AuditProbe loaded = probes.findById(probe.getId()).orElseThrow();
            loaded.setOwner(users.getReferenceById(otherLawyer.getId()));
        }));

        assertThat(historyOf(probe).getLast().getChanges()).containsExactly(
                new FieldChange("owner", lawyer.getId().toString(), otherLawyer.getId().toString()));
    }

    @Test
    void shouldIgnoreChangesToNotAuditedFields() {
        AuditProbe probe = createProbe("Legajo", null);

        modifyProbe(probe, p -> p.setCounter(p.getCounter() + 1));

        assertThat(historyOf(probe)).extracting(AuditEvent::getAction).containsExactly(AuditAction.CREATE);
    }

    @Test
    void shouldRecordArchivingAndRestoring() {
        AuditProbe probe = createProbe("Legajo", null);

        modifyProbe(probe, p -> p.setArchivedAt(Instant.now()));
        modifyProbe(probe, p -> p.setArchivedAt(null));

        assertThat(historyOf(probe))
                .extracting(AuditEvent::getAction)
                .containsExactly(AuditAction.CREATE, AuditAction.ARCHIVE, AuditAction.RESTORE);
    }

    @Test
    void shouldRecordArchivingTogetherWithOtherChangesAsOneEvent() {
        AuditProbe probe = createProbe("Legajo", null);

        modifyProbe(probe, p -> {
            p.setLabel("Legajo cerrado");
            p.setArchivedAt(Instant.now());
        });

        assertThat(historyOf(probe).getLast()).satisfies(event -> {
            assertThat(event.getAction()).isEqualTo(AuditAction.ARCHIVE);
            assertThat(event.getChanges())
                    .extracting(FieldChange::field)
                    .containsExactlyInAnyOrder("label", AuditRecorder.ARCHIVED_AT);
        });
    }

    @Test
    void shouldNameTheLoggedInUserAsTheActor() {
        authenticateAs(lawyer);

        AuditProbe probe = probes.save(new AuditProbe("Legajo", null, null));
        transactionTemplate.executeWithoutResult(
                status -> users.findById(lawyer.getId()).orElseThrow().startTotpEnrollment("v1:cifrado-ficticio"));

        assertThat(historyOf(probe)).singleElement()
                .extracting(AuditEvent::getActorUserId)
                .isEqualTo(lawyer.getId());
        List<AuditEvent> changesByLawyer = TenantContext.callAs(tenantA, () -> auditTrail.changesMadeBy(lawyer.getId()));
        assertThat(changesByLawyer).extracting(AuditEvent::getEntityId).containsExactly(probe.getId(), lawyer.getId());
        assertThat(changesByLawyer.getLast().getChanges())
                .containsExactly(new FieldChange("totpSecret", null, FieldChange.REDACTED));
    }

    @Test
    void shouldNeverAttributeAChangeToAUserOfAnotherFirm() {
        AuditProbe probe = createProbe("Legajo", null);
        AppUser outsider = TenantContext.callAs(tenantB,
                () -> userService.createUser("ajeno@ejemplo.test", "Ajeno Ficticio", PASSWORD, Role.LAWYER));
        authenticateAs(outsider);

        Throwable thrown = catchThrowable(() -> modifyProbe(probe, p -> p.setLabel("Cambio ajeno")));

        assertThat(thrown).isNotNull();
        SecurityContextHolder.clearContext();
        assertThat(historyOf(probe)).extracting(AuditEvent::getAction).containsExactly(AuditAction.CREATE);
        assertThat(TenantContext.callAs(tenantA, () -> probes.findById(probe.getId())).orElseThrow().getLabel())
                .isEqualTo("Legajo");
    }

    @Test
    void shouldDiscardTheHistoryOfARolledBackChange() {
        AuditProbe probe = createProbe("Legajo", null);

        TenantContext.runAs(tenantA, () -> transactionTemplate.executeWithoutResult(status -> {
            probes.findById(probe.getId()).orElseThrow().setLabel("Nunca guardado");
            probes.flush();
            status.setRollbackOnly();
        }));

        assertThat(historyOf(probe)).extracting(AuditEvent::getAction).containsExactly(AuditAction.CREATE);
    }

    @Test
    void shouldNotShowOneFirmsHistoryToAnother() {
        AuditProbe probe = createProbe("Legajo", null);

        assertThat(TenantContext.callAs(tenantB, () -> auditTrail.historyOf(AuditProbe.class, probe.getId())))
                .isEmpty();
        assertThat(TenantContext.callAs(tenantB, () -> auditTrail.changesMadeBy(lawyer.getId()))).isEmpty();
    }

    @Test
    void shouldRejectDeletingAnEntityAndKeepTheRow() {
        AuditProbe probe = createProbe("Legajo", null);

        Throwable thrown = catchThrowable(() -> TenantContext.runAs(tenantA, () -> probes.deleteById(probe.getId())));

        assertThat(NestedExceptionUtils.getMostSpecificCause(thrown))
                .isInstanceOf(ArchiveInsteadOfDeleteException.class);

        assertThat(TenantContext.callAs(tenantA, () -> probes.findById(probe.getId()))).isPresent();
    }

    @Test
    void shouldRejectRewritingOrErasingTheHistoryInTheDatabase() {
        AuditProbe probe = createProbe("Legajo", null);

        assertRejectedAsAppendOnly(
                () -> jdbc.update("update audit_event set action = 'UPDATE' where entity_id = ?", probe.getId()));
        assertRejectedAsAppendOnly(() -> jdbc.update("delete from audit_event where entity_id = ?", probe.getId()));
        assertRejectedAsAppendOnly(() -> jdbc.execute("truncate audit_event"));
        assertThat(historyOf(probe)).hasSize(1);
    }

    @Test
    void shouldRecordUserChangesWithoutTheirSecrets() {
        TenantContext.runAs(tenantA, () -> transactionTemplate.executeWithoutResult(
                status -> users.findById(lawyer.getId()).orElseThrow().archive()));

        List<AuditEvent> history = TenantContext.callAs(tenantA, () -> auditTrail.historyOf(AppUser.class, lawyer.getId()));

        assertThat(history).extracting(AuditEvent::getAction).containsExactly(AuditAction.CREATE, AuditAction.ARCHIVE);
        assertThat(history.getFirst().getChanges())
                .contains(new FieldChange("passwordHash", null, FieldChange.REDACTED))
                .contains(new FieldChange("role", null, "LAWYER"))
                .extracting(FieldChange::field)
                .doesNotContain("tenantId", "totpLastStep");
        assertThat(history.getLast().getChanges()).singleElement()
                .extracting(FieldChange::field)
                .isEqualTo(AuditRecorder.ARCHIVED_AT);
    }

    private static void assertRejectedAsAppendOnly(Runnable statement) {
        Throwable thrown = catchThrowable(statement::run);

        assertThat(NestedExceptionUtils.getMostSpecificCause(thrown)).hasMessageContaining("append-only");
    }

    private AuditProbe createProbe(String label, String secret) {
        return TenantContext.callAs(tenantA, () -> probes.save(new AuditProbe(label, secret, lawyer)));
    }

    private void modifyProbe(AuditProbe probe, Consumer<AuditProbe> change) {
        TenantContext.runAs(tenantA, () -> transactionTemplate.executeWithoutResult(
                status -> change.accept(probes.findById(probe.getId()).orElseThrow())));
    }

    private List<AuditEvent> historyOf(AuditProbe probe) {
        return TenantContext.callAs(tenantA, () -> auditTrail.historyOf(AuditProbe.class, probe.getId()));
    }

    /** Uses the same principal the login stores in the session. */
    private void authenticateAs(AppUser user) {
        var principal = new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), Instant.now());
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken(principal, null, user.getRole().authority()));
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
