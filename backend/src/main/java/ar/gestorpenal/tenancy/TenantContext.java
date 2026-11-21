package ar.gestorpenal.tenancy;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Explicit tenant scope for code that runs without an authenticated user, such as seed data,
 * scheduled jobs or tests. Request handling relies on the authenticated {@link TenantPrincipal}
 * instead.
 *
 * <p>Hibernate binds the tenant when a session opens, so a scope must be entered
 * <em>before</em> a transaction starts; entering one inside a transaction is rejected.
 *
 * <p>The scope is bound to the current thread and is <em>not</em> propagated to {@code @Async}
 * methods, executors or scheduler threads. Such work fails closed (sees no tenant) and must enter
 * its own scope.
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> EXPLICIT_TENANT = new ThreadLocal<>();

    private TenantContext() {}

    public static void runAs(UUID tenantId, Runnable action) {
        callAs(tenantId, () -> {
            action.run();
            return null;
        });
    }

    public static <T> T callAs(UUID tenantId, Supplier<T> action) {
        Objects.requireNonNull(tenantId, "tenantId");
        if (CurrentTenantResolver.NO_TENANT.equals(tenantId)) {
            throw new IllegalArgumentException("The no-tenant sentinel is not a tenant");
        }
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException(
                    "Tenant scope must be entered before the transaction starts: the session is already bound to a tenant");
        }
        UUID previous = EXPLICIT_TENANT.get();
        EXPLICIT_TENANT.set(tenantId);
        try {
            return action.get();
        } finally {
            if (previous == null) {
                EXPLICIT_TENANT.remove();
            } else {
                EXPLICIT_TENANT.set(previous);
            }
        }
    }

    static Optional<UUID> explicitTenant() {
        return Optional.ofNullable(EXPLICIT_TENANT.get());
    }
}
