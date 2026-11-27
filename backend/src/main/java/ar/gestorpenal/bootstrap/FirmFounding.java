package ar.gestorpenal.bootstrap;

import ar.gestorpenal.audit.AuditJournal;
import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService.TenantSummary;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The one path that creates a firm and its owner (ADR-0047, ADR-0050): the first-firm bootstrap and the
 * self sign-up both go through it. It enters the new firm's {@link TenantContext} scope, then opens one
 * transaction in which the firm is created, its creation is written to the firm's history with no author
 * (the system), and the owner is created. A failure leaves nothing behind.
 */
@Service
public class FirmFounding {

    private final AuditJournal journal;
    private final TransactionTemplate transaction;

    FirmFounding(AuditJournal journal, PlatformTransactionManager transactionManager) {
        this.journal = journal;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /** The firm as created, and whatever the owner step returned. */
    public record Founded<T>(TenantSummary firm, T owner) {}

    /**
     * @param createFirm creates the firm in the scope's id (a {@code TenantService.create...InScope}
     *     method), or returns empty to create nothing
     * @param extraFields fields of the firm, besides name and slug, to write in its history
     * @param createOwner creates the owner inside the new firm's scope
     * @return empty when {@code createFirm} created nothing
     */
    public <T> Optional<Founded<T>> found(
            Supplier<Optional<TenantSummary>> createFirm,
            List<FieldChange> extraFields,
            Function<TenantSummary, T> createOwner) {
        // The scope must be entered before the transaction starts (TenantContext).
        return TenantContext.callAs(UUID.randomUUID(), () -> transaction.execute(status ->
                createFirm.get().map(firm -> {
                    List<FieldChange> fields = new ArrayList<>(List.of(
                            new FieldChange("name", null, firm.name()),
                            new FieldChange("slug", null, firm.slug())));
                    fields.addAll(extraFields);
                    journal.recordCreate(firm.id(), Tenant.class, firm.id(), fields);
                    return new Founded<>(firm, createOwner.apply(firm));
                })));
    }
}
