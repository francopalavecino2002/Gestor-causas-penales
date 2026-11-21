package ar.gestorpenal.tenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;

import ar.gestorpenal.TestcontainersConfiguration;
import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;

/** Proves that one firm can never see or change another firm's data through JPA. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TenantIsolationTests {

    @Autowired
    private TenantRepository tenants;

    @Autowired
    private IsolationProbeRepository probes;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private UUID tenantA;
    private UUID tenantB;
    private IsolationProbe probeOfB;

    @BeforeEach
    void createTwoFirmsWithOneRecordEach() {
        tenantA = tenants.save(new Tenant("Estudio Ficticio Alfa", uniqueSlug("alfa"))).getId();
        tenantB = tenants.save(new Tenant("Estudio Ficticio Beta", uniqueSlug("beta"))).getId();
        TenantContext.runAs(tenantA, () -> probes.save(new IsolationProbe("shared-label")));
        probeOfB = TenantContext.callAs(tenantB, () -> probes.save(new IsolationProbe("shared-label")));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldStampTheCurrentTenantOnInsert() {
        assertThat(probeOfB.getTenantId()).isEqualTo(tenantB);
    }

    @Test
    void shouldListOnlyTheCurrentTenantsRows() {
        List<IsolationProbe> visibleToA = TenantContext.callAs(tenantA, probes::findAll);

        assertThat(visibleToA).isNotEmpty().allSatisfy(p -> assertThat(p.getTenantId()).isEqualTo(tenantA));
        assertThat(visibleToA).extracting(IsolationProbe::getId).doesNotContain(probeOfB.getId());
    }

    @Test
    void shouldNotFindAnotherTenantsRowById() {
        assertThat(TenantContext.callAs(tenantA, () -> probes.findById(probeOfB.getId()))).isEmpty();
        assertThat(TenantContext.callAs(tenantA, () -> probes.existsById(probeOfB.getId()))).isFalse();
        assertThat(TenantContext.callAs(tenantB, () -> probes.findById(probeOfB.getId()))).isPresent();
    }

    @Test
    void shouldFilterDerivedQueriesAndCounts() {
        List<IsolationProbe> byLabel = TenantContext.callAs(tenantA, () -> probes.findByLabel("shared-label"));

        assertThat(byLabel).allSatisfy(p -> assertThat(p.getTenantId()).isEqualTo(tenantA));
        long countForA = TenantContext.callAs(tenantA, () -> probes.count());
        assertThat(countForA).isEqualTo(TenantContext.callAs(tenantA, probes::findAll).size());
    }

    @Test
    void shouldNotUpdateOrDeleteAnotherTenantsRows() {
        TenantContext.runAs(tenantA, () -> {
            probes.relabelAll("changed-by-a");
            probes.deleteById(probeOfB.getId());
            probes.deleteAllInBulk();
        });

        assertThat(TenantContext.callAs(tenantB, () -> probes.findById(probeOfB.getId())))
                .get()
                .extracting(IsolationProbe::getLabel)
                .isEqualTo("shared-label");
    }

    @Test
    void shouldNotMoveARowToAnotherTenant() throws Exception {
        Field tenantIdField = TenantScopedEntity.class.getDeclaredField("tenantId");
        tenantIdField.setAccessible(true);
        IsolationProbe loaded = TenantContext.callAs(tenantB, () -> probes.findById(probeOfB.getId()).orElseThrow());
        tenantIdField.set(loaded, tenantA);

        catchThrowable(() -> TenantContext.runAs(tenantB, () -> probes.saveAndFlush(loaded)));

        assertThat(TenantContext.callAs(tenantA, () -> probes.findById(probeOfB.getId()))).isEmpty();
        assertThat(TenantContext.callAs(tenantB, () -> probes.findById(probeOfB.getId()))).isPresent();
    }

    @Test
    void shouldNotPropagateTheScopeToOtherThreads() {
        List<IsolationProbe> seenByOtherThread = TenantContext.callAs(
                tenantA, () -> CompletableFuture.supplyAsync(probes::findAll).join());

        assertThat(seenByOtherThread).isEmpty();
    }

    @Test
    void shouldResolveTheTenantFromTheAuthenticatedPrincipal() {
        var authentication = new TestingAuthenticationToken(new FakeLawyer(tenantA), null, "ROLE_LAWYER");
        SecurityContextHolder.getContext().setAuthentication(authentication);

        List<IsolationProbe> visible = probes.findAll();

        assertThat(visible).isNotEmpty().allSatisfy(p -> assertThat(p.getTenantId()).isEqualTo(tenantA));
    }

    @Test
    void shouldFailClosedWhenNoTenantIsResolved() {
        assertThat(probes.findAll()).isEmpty();
        assertThat(probes.findById(probeOfB.getId())).isEmpty();
        assertThatThrownBy(() -> probes.save(new IsolationProbe("orphan")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void shouldRejectEnteringATenantScopeInsideATransaction() {
        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(
                        status -> TenantContext.runAs(tenantA, probes::count)))
                .isInstanceOf(IllegalStateException.class);
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private record FakeLawyer(UUID tenantId) implements TenantPrincipal {}
}
