package ar.gestorpenal.tenancy;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point to firms. It never lists tenants: callers either create one or
 * look up a single firm they already know (by slug at login, by id from the session).
 */
@Service
public class TenantService {

    private final TenantRepository tenants;
    private final EntityManager entityManager;

    TenantService(TenantRepository tenants, EntityManager entityManager) {
        this.tenants = tenants;
        this.entityManager = entityManager;
    }

    @Transactional
    public TenantSummary create(String name, String slug) {
        return TenantSummary.of(tenants.save(new Tenant(name, slug)));
    }

    /**
     * Creates the first firm of an empty database (T66, ADR-0047) inside the caller's transaction, or
     * returns empty when any firm, archived or not, already exists. The {@code tenant} table stays
     * locked until the caller commits, so two runs at once create one firm and the second sees it.
     *
     * <p>The firm gets the id of the explicit {@link TenantContext} scope the caller entered, so its
     * owner can be created in the same transaction: either both exist afterwards or neither does. The
     * name and slug must already be valid; the table's constraints are the last line of defense.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<TenantSummary> createFirstFirmInScope(String name, String slug) {
        UUID id = TenantContext.explicitTenant()
                .orElseThrow(() -> new IllegalStateException("Enter the new firm's TenantContext scope first"));
        // EXCLUSIVE still lets readers in but blocks every other writer, this same lock included.
        entityManager.createNativeQuery("LOCK TABLE tenant IN EXCLUSIVE MODE").executeUpdate();
        if (tenants.count() > 0) {
            return Optional.empty();
        }
        // Native: the entity's id is generated, and this one must be the scope's. The other columns
        // take their defaults (jurisdiction, practice areas, created_at), like a new Tenant.
        entityManager.createNativeQuery("INSERT INTO tenant (id, name, slug) VALUES (?1, ?2, ?3)")
                .setParameter(1, id)
                .setParameter(2, name)
                .setParameter(3, slug)
                .executeUpdate();
        return Optional.of(new TenantSummary(id, name, slug));
    }

    /** The id of a non-archived firm, used to scope the login lookup. */
    @Transactional(readOnly = true)
    public Optional<UUID> findActiveIdBySlug(String slug) {
        return tenants.findBySlug(slug)
                .filter(tenant -> tenant.getArchivedAt() == null)
                .map(Tenant::getId);
    }

    /** Whether any firm, archived or not, already uses the slug (slugs are never reused). */
    @Transactional(readOnly = true)
    public boolean isSlugTaken(String slug) {
        return tenants.findBySlug(slug).isPresent();
    }

    @Transactional(readOnly = true)
    public Optional<TenantSummary> describe(UUID tenantId) {
        return tenants.findById(tenantId).map(TenantSummary::of);
    }

    /**
     * The jurisdiction package of the firm in scope (the authenticated user's, or an explicit
     * {@link TenantContext}). Fails closed when no firm is in scope.
     */
    @Transactional(readOnly = true)
    public String currentJurisdictionCode() {
        return currentTenant().getJurisdictionCode();
    }

    private Tenant currentTenant() {
        UUID current = new CurrentTenantResolver().resolveCurrentTenantIdentifier();
        return tenants.findById(current).orElseThrow(() -> new IllegalStateException("No firm in scope"));
    }

    /** The practice areas the firm in scope works in, by code. Fails closed when no firm is in scope. */
    @Transactional(readOnly = true)
    public List<String> currentEnabledPracticeAreas() {
        return currentTenant().getEnabledPracticeAreas();
    }

    /**
     * The practice areas of the firm in scope, read again from the database with the firm's row locked
     * {@code FOR UPDATE} until the caller's transaction ends: two changes of the areas run one after the
     * other, and a case being opened (which holds {@link #currentEnabledPracticeAreasForNewWork} meanwhile)
     * finishes first, so the in-use check sees it.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<String> lockCurrentEnabledPracticeAreas() {
        return lockedCurrentTenant(LockModeType.PESSIMISTIC_WRITE).getEnabledPracticeAreas();
    }

    /**
     * The practice areas of the firm in scope, read again with the firm's row locked {@code FOR SHARE}
     * until the caller's transaction ends, so the areas cannot change while new work is opened in one.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<String> currentEnabledPracticeAreasForNewWork() {
        return lockedCurrentTenant(LockModeType.PESSIMISTIC_READ).getEnabledPracticeAreas();
    }

    /** Refresh, not a query: a query would hand back the copy already in the session, possibly stale. */
    private Tenant lockedCurrentTenant(LockModeType lock) {
        Tenant tenant = currentTenant();
        entityManager.refresh(tenant, lock);
        return tenant;
    }

    /**
     * Replaces the practice areas of the firm in scope, already validated by the caller, and returns the
     * id of the firm. Fails closed when no firm is in scope.
     */
    @Transactional
    public UUID changeCurrentEnabledPracticeAreas(List<String> codes) {
        Tenant tenant = currentTenant();
        tenant.changeEnabledPracticeAreas(codes);
        return tenant.getId();
    }

    public record TenantSummary(UUID id, String name, String slug) {

        static TenantSummary of(Tenant tenant) {
            return new TenantSummary(tenant.getId(), tenant.getName(), tenant.getSlug());
        }
    }
}
