package ar.gestorpenal.tenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class TenantContextTests {

    private final CurrentTenantResolver resolver = new CurrentTenantResolver();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldResolveNoTenantSentinelOutsideAnyScope() {
        assertThat(resolver.resolveCurrentTenantIdentifier()).isEqualTo(CurrentTenantResolver.NO_TENANT);
    }

    @Test
    void shouldRestoreTheOuterScopeAfterANestedOne() {
        UUID outer = UUID.randomUUID();
        UUID inner = UUID.randomUUID();

        TenantContext.runAs(outer, () -> {
            assertThat(TenantContext.callAs(inner, resolver::resolveCurrentTenantIdentifier)).isEqualTo(inner);
            assertThat(resolver.resolveCurrentTenantIdentifier()).isEqualTo(outer);
        });

        assertThat(TenantContext.explicitTenant()).isEmpty();
    }

    @Test
    void shouldClearTheScopeWhenTheActionThrows() {
        assertThatThrownBy(() -> TenantContext.runAs(UUID.randomUUID(), () -> {
                    throw new IllegalArgumentException("boom");
                }))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(TenantContext.explicitTenant()).isEmpty();
    }

    @Test
    void shouldPreferTheExplicitScopeOverTheAuthenticatedPrincipal() {
        UUID fromUser = UUID.randomUUID();
        UUID explicit = UUID.randomUUID();
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken(new Principal(fromUser), null, "ROLE_LAWYER"));

        assertThat(resolver.resolveCurrentTenantIdentifier()).isEqualTo(fromUser);
        assertThat(TenantContext.callAs(explicit, resolver::resolveCurrentTenantIdentifier)).isEqualTo(explicit);
    }

    @Test
    void shouldIgnorePrincipalsThatCarryNoTenant() {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("plain-user", null, "ROLE_LAWYER"));

        assertThat(resolver.resolveCurrentTenantIdentifier()).isEqualTo(CurrentTenantResolver.NO_TENANT);
    }

    @Test
    void shouldRejectANullTenant() {
        assertThatThrownBy(() -> TenantContext.runAs(null, () -> {})).isInstanceOf(NullPointerException.class);
    }

    @Test
    void shouldRejectTheNoTenantSentinelAsAScope() {
        assertThatThrownBy(() -> TenantContext.runAs(CurrentTenantResolver.NO_TENANT, () -> {}))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private record Principal(UUID tenantId) implements TenantPrincipal {}
}
